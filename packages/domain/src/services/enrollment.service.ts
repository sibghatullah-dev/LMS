import mongoose, { type HydratedDocument } from 'mongoose';
import { CourseModel } from '../models/course.model';
import { EnrollmentModel, type Enrollment } from '../models/enrollment.model';
import { UserModel } from '../models/user.model';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import type {
  DropEnrollmentInput,
  EnrollInput,
  MyEnrollmentsQueryInput,
  RejectEnrollmentInput,
  RosterQueryInput,
} from '../schemas/enrollment.schema';
import { assertEnrollmentTransition } from './enrollment-state';
import { toCourseCard } from './course-serialize';
import { writeAudit } from './audit.service';
import { notifyUser } from './notification.service';

const { Types } = mongoose;

const isManager = (ctx: AuthContext) => hasAnyRole(ctx.role, ['admin', 'super_admin']);

export interface PublicEnrollment {
  id: string;
  courseId: string;
  studentId: string;
  status: string;
  enrolledAt?: Date;
  completedAt?: Date;
  finalGradePercent?: number;
  droppedReason?: string;
}

function toPublicEnrollment(doc: HydratedDocument<Enrollment>): PublicEnrollment {
  return {
    id: String(doc._id),
    courseId: String(doc.courseId),
    studentId: String(doc.studentId),
    status: doc.status,
    enrolledAt: doc.enrolledAt ?? undefined,
    completedAt: doc.completedAt ?? undefined,
    finalGradePercent: doc.finalGradePercent ?? undefined,
    droppedReason: doc.droppedReason ?? undefined,
  };
}

/** Count enrollments that occupy a capacity slot (active + still-pending). */
async function occupiedSlots(courseId: string): Promise<number> {
  return EnrollmentModel.countDocuments({
    courseId,
    status: { $in: ['active', 'pending_approval'] },
  });
}

async function assertCapacity(course: { _id: unknown; enrollmentCapacity?: number | null }, adding = 1) {
  if (course.enrollmentCapacity == null) return;
  const used = await occupiedSlots(String(course._id));
  if (used + adding > course.enrollmentCapacity) {
    throw ConflictError('This course has reached its enrollment capacity.');
  }
}

async function loadCourseInTenant(ctx: AuthContext, courseId: string) {
  if (!Types.ObjectId.isValid(courseId)) throw NotFoundError('Course not found.');
  const course = await CourseModel.findOne({ _id: courseId, institutionId: ctx.institutionId });
  if (!course) throw NotFoundError('Course not found.');
  return course;
}

/** Instructor-owner or admin may manage a course's enrollments. */
function assertCourseStaff(ctx: AuthContext, course: { instructorId: unknown }) {
  if (isManager(ctx)) return;
  if (String(course.instructorId) === ctx.userId) return;
  throw ForbiddenError('You do not manage this course.');
}

/** FR-ENROLL-01/02 — a student enrolls themselves in a published course. */
export async function enrollSelf(ctx: AuthContext, courseId: string): Promise<PublicEnrollment> {
  const course = await loadCourseInTenant(ctx, courseId);
  if (course.status !== 'published') {
    throw ValidationError('This course is not open for enrollment.');
  }

  const existing = await EnrollmentModel.findOne({ courseId, studentId: ctx.userId });
  if (existing && ['active', 'pending_approval', 'completed'].includes(existing.status)) {
    throw ConflictError('You are already enrolled in this course.');
  }

  await assertCapacity(course);
  const status = course.enrollmentMode === 'open' ? 'active' : 'pending_approval';

  const enrollment =
    existing ??
    new EnrollmentModel({
      institutionId: ctx.institutionId,
      courseId,
      studentId: ctx.userId,
    });
  enrollment.status = status;
  enrollment.enrolledAt = new Date();
  enrollment.droppedReason = undefined;
  enrollment.droppedBy = undefined;
  await enrollment.save();

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'enrollment.create',
    targetEntity: { type: 'enrollment', id: enrollment._id },
    after: { courseId, status },
  });
  return toPublicEnrollment(enrollment);
}

/** FR-ENROLL-03 — staff bulk-enroll students by id and/or email (bypasses approval). */
export async function bulkEnroll(
  ctx: AuthContext,
  courseId: string,
  input: EnrollInput,
): Promise<{ enrolled: number; skipped: number; notFound: string[] }> {
  const course = await loadCourseInTenant(ctx, courseId);
  assertCourseStaff(ctx, course);

  // Resolve target students within the institution.
  const idSet = new Set((input.studentIds ?? []).filter((id) => Types.ObjectId.isValid(id)));
  const emails = (input.studentEmails ?? []).map((e) => e.toLowerCase());
  const notFound: string[] = [];

  if (emails.length) {
    const found = await UserModel.find({
      institutionId: ctx.institutionId,
      email: { $in: emails },
    }).select('_id email');
    const foundEmails = new Set(found.map((u) => u.email));
    found.forEach((u) => idSet.add(String(u._id)));
    emails.forEach((e) => {
      if (!foundEmails.has(e)) notFound.push(e);
    });
  }

  const ids = [...idSet];
  await assertCapacity(course, ids.length);

  let enrolled = 0;
  let skipped = 0;
  for (const studentId of ids) {
    const existing = await EnrollmentModel.findOne({ courseId, studentId });
    if (existing && ['active', 'pending_approval', 'completed'].includes(existing.status)) {
      skipped++;
      continue;
    }
    const doc =
      existing ??
      new EnrollmentModel({ institutionId: ctx.institutionId, courseId, studentId });
    doc.status = 'active';
    doc.enrolledAt = new Date();
    doc.approvedBy = new Types.ObjectId(ctx.userId) as unknown as typeof doc.approvedBy;
    await doc.save();
    enrolled++;
  }

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'enrollment.bulk_create',
    targetEntity: { type: 'course', id: course._id },
    after: { enrolled, skipped, requested: ids.length },
  });
  return { enrolled, skipped, notFound };
}

/** FR-ENROLL — instructor/admin roster for a course, with student summaries. */
export async function listRoster(ctx: AuthContext, courseId: string, query: RosterQueryInput) {
  const course = await loadCourseInTenant(ctx, courseId);
  assertCourseStaff(ctx, course);

  const filter: Record<string, unknown> = { courseId };
  if (query.status) filter.status = query.status;

  const [docs, total] = await Promise.all([
    EnrollmentModel.find(filter)
      .sort({ enrolledAt: -1 })
      .skip((query.page - 1) * query.pageSize)
      .limit(query.pageSize)
      .populate<{ studentId: { _id: unknown; fullName: string; email: string } }>(
        'studentId',
        'fullName email',
      ),
    EnrollmentModel.countDocuments(filter),
  ]);

  const rows = docs.map((d) => {
    const student = d.studentId as unknown as { _id: unknown; fullName: string; email: string };
    return {
      id: String(d._id),
      status: d.status,
      enrolledAt: d.enrolledAt,
      student: { id: String(student._id), fullName: student.fullName, email: student.email },
    };
  });
  return { enrollments: rows, total, page: query.page, pageSize: query.pageSize };
}

/** FR-ENROLL-04 — a student's own enrollments with course cards. */
export async function getMyEnrollments(ctx: AuthContext, query: MyEnrollmentsQueryInput) {
  const filter: Record<string, unknown> = { studentId: ctx.userId };
  if (query.status) filter.status = query.status;

  const docs = await EnrollmentModel.find(filter).sort({ enrolledAt: -1 });
  const courseIds = docs.map((d) => d.courseId);
  const courses = await CourseModel.find({ _id: { $in: courseIds } });
  const cardById = new Map(courses.map((c) => [String(c._id), toCourseCard(c)]));

  return {
    enrollments: docs.map((d) => ({
      ...toPublicEnrollment(d),
      course: cardById.get(String(d.courseId)) ?? null,
    })),
  };
}

async function loadEnrollmentForStaff(ctx: AuthContext, enrollmentId: string) {
  if (!Types.ObjectId.isValid(enrollmentId)) throw NotFoundError('Enrollment not found.');
  const enrollment = await EnrollmentModel.findOne({
    _id: enrollmentId,
    institutionId: ctx.institutionId,
  });
  if (!enrollment) throw NotFoundError('Enrollment not found.');
  const course = await CourseModel.findById(enrollment.courseId);
  if (!course) throw NotFoundError('Course not found.');
  return { enrollment, course };
}

async function auditStatusChange(
  ctx: AuthContext,
  enrollment: HydratedDocument<Enrollment>,
  before: string,
) {
  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'enrollment.status_change',
    targetEntity: { type: 'enrollment', id: enrollment._id },
    before: { status: before },
    after: {
      status: enrollment.status,
      droppedReason: enrollment.droppedReason,
    },
  });
}

/** FR-ENROLL-02 — approve a pending enrollment. */
export async function approveEnrollment(
  ctx: AuthContext,
  enrollmentId: string,
): Promise<PublicEnrollment> {
  const { enrollment, course } = await loadEnrollmentForStaff(ctx, enrollmentId);
  assertCourseStaff(ctx, course);
  const before = enrollment.status;
  assertEnrollmentTransition(before, 'active');
  enrollment.status = 'active';
  enrollment.approvedBy = new Types.ObjectId(ctx.userId) as unknown as typeof enrollment.approvedBy;
  await enrollment.save();
  await auditStatusChange(ctx, enrollment, before);
  await notifyUser({
    institutionId: ctx.institutionId,
    userId: enrollment.studentId,
    type: 'enrollment_status',
    title: 'Enrollment approved',
    body: `You can now access ${course.title}.`,
    actionUrl: `/learn/${String(course._id)}`,
    relatedEntity: { type: 'enrollment', id: enrollment._id },
  });
  return toPublicEnrollment(enrollment);
}

/** FR-ENROLL-02 — reject a pending enrollment. */
export async function rejectEnrollment(
  ctx: AuthContext,
  enrollmentId: string,
  input: RejectEnrollmentInput,
): Promise<PublicEnrollment> {
  const { enrollment, course } = await loadEnrollmentForStaff(ctx, enrollmentId);
  assertCourseStaff(ctx, course);
  const before = enrollment.status;
  assertEnrollmentTransition(before, 'rejected');
  enrollment.status = 'rejected';
  enrollment.droppedReason = input.reason;
  await enrollment.save();
  await auditStatusChange(ctx, enrollment, before);
  await notifyUser({
    institutionId: ctx.institutionId,
    userId: enrollment.studentId,
    type: 'enrollment_status',
    title: 'Enrollment rejected',
    body: input.reason,
    actionUrl: `/catalog`,
    relatedEntity: { type: 'enrollment', id: enrollment._id },
  });
  return toPublicEnrollment(enrollment);
}

/**
 * FR-ENROLL-05 — drop/withdraw. A student may withdraw themselves; staff may
 * withdraw a student but must supply a reason (logged to the audit trail).
 */
export async function dropEnrollment(
  ctx: AuthContext,
  enrollmentId: string,
  input: DropEnrollmentInput,
): Promise<PublicEnrollment> {
  if (!Types.ObjectId.isValid(enrollmentId)) throw NotFoundError('Enrollment not found.');
  const enrollment = await EnrollmentModel.findOne({
    _id: enrollmentId,
    institutionId: ctx.institutionId,
  });
  if (!enrollment) throw NotFoundError('Enrollment not found.');

  const isSelf = String(enrollment.studentId) === ctx.userId;
  if (!isSelf) {
    const course = await CourseModel.findById(enrollment.courseId);
    if (!course) throw NotFoundError('Course not found.');
    assertCourseStaff(ctx, course);
    if (!input.reason?.trim()) {
      throw ValidationError('A reason is required to withdraw a student.');
    }
  }

  const before = enrollment.status;
  assertEnrollmentTransition(before, 'dropped');
  enrollment.status = 'dropped';
  enrollment.droppedReason = input.reason;
  enrollment.droppedBy = new Types.ObjectId(ctx.userId) as unknown as typeof enrollment.droppedBy;
  await enrollment.save();
  await auditStatusChange(ctx, enrollment, before);
  return toPublicEnrollment(enrollment);
}
