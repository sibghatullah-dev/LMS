import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InstitutionModel } from '../src/models/institution.model';
import { UserModel } from '../src/models/user.model';
import { CourseModel } from '../src/models/course.model';
import { EnrollmentModel } from '../src/models/enrollment.model';
import { AuditLogModel } from '../src/models/audit-log.model';
import {
  approveEnrollment,
  bulkEnroll,
  dropEnrollment,
  enrollSelf,
  getMyEnrollments,
  listRoster,
  rejectEnrollment,
} from '../src/services/enrollment.service';
import type { AuthContext } from '../src/rbac/roles';

async function makeInstitution(slug: string) {
  const inst = await InstitutionModel.create({ name: slug, slug });
  return String(inst._id);
}
let seq = 0;
async function makeUser(institutionId: string, role: AuthContext['role']): Promise<AuthContext> {
  const u = await UserModel.create({
    institutionId,
    email: `${role}-${seq++}@x.com`,
    fullName: role,
    role,
    status: 'active',
  });
  return { userId: String(u._id), institutionId, role };
}
async function makeCourse(
  institutionId: string,
  instructorId: string,
  opts: { mode?: 'open' | 'approval_required'; capacity?: number; status?: string } = {},
) {
  const c = await CourseModel.create({
    institutionId,
    instructorId,
    title: `Course ${seq++}`,
    slug: `course-${seq}`,
    status: opts.status ?? 'published',
    enrollmentMode: opts.mode ?? 'open',
    enrollmentCapacity: opts.capacity,
    modules: [{ title: 'M1', order: 0, lessons: [] }],
  });
  return String(c._id);
}

let institutionId: string;
let instructor: AuthContext;

beforeAll(async () => {
  await EnrollmentModel.createIndexes();
});
beforeEach(async () => {
  institutionId = await makeInstitution('lumora');
  instructor = await makeUser(institutionId, 'instructor');
});

describe('self-enrollment (FR-ENROLL-01/02)', () => {
  it('open course → immediately active', async () => {
    const student = await makeUser(institutionId, 'student');
    const courseId = await makeCourse(institutionId, instructor.userId, { mode: 'open' });
    const e = await enrollSelf(student, courseId);
    expect(e.status).toBe('active');
  });

  it('approval_required course → pending, then approve → active', async () => {
    const student = await makeUser(institutionId, 'student');
    const courseId = await makeCourse(institutionId, instructor.userId, { mode: 'approval_required' });
    const e = await enrollSelf(student, courseId);
    expect(e.status).toBe('pending_approval');

    const approved = await approveEnrollment(instructor, e.id);
    expect(approved.status).toBe('active');
  });

  it('rejects double-enrollment', async () => {
    const student = await makeUser(institutionId, 'student');
    const courseId = await makeCourse(institutionId, instructor.userId);
    await enrollSelf(student, courseId);
    await expect(enrollSelf(student, courseId)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it('cannot enroll in a non-published course', async () => {
    const student = await makeUser(institutionId, 'student');
    const draft = await makeCourse(institutionId, instructor.userId, { status: 'draft' });
    await expect(enrollSelf(student, draft)).rejects.toMatchObject({ httpStatus: 400 });
  });
});

describe('capacity (FR-ENROLL-06)', () => {
  it('blocks enrollment beyond capacity', async () => {
    const courseId = await makeCourse(institutionId, instructor.userId, { capacity: 1 });
    const s1 = await makeUser(institutionId, 'student');
    const s2 = await makeUser(institutionId, 'student');
    await enrollSelf(s1, courseId);
    await expect(enrollSelf(s2, courseId)).rejects.toMatchObject({ httpStatus: 409 });
  });
});

describe('approval + rejection (FR-ENROLL-02, audited)', () => {
  it('rejects a pending enrollment with a reason', async () => {
    const student = await makeUser(institutionId, 'student');
    const courseId = await makeCourse(institutionId, instructor.userId, { mode: 'approval_required' });
    const e = await enrollSelf(student, courseId);
    const rejected = await rejectEnrollment(instructor, e.id, { reason: 'Prerequisite missing' });
    expect(rejected.status).toBe('rejected');
    const log = await AuditLogModel.findOne({
      action: 'enrollment.status_change',
      'targetEntity.id': e.id,
    }).lean();
    expect(log).toBeTruthy();
  });

  it('a non-owning instructor cannot approve', async () => {
    const other = await makeUser(institutionId, 'instructor');
    const student = await makeUser(institutionId, 'student');
    const courseId = await makeCourse(institutionId, instructor.userId, { mode: 'approval_required' });
    const e = await enrollSelf(student, courseId);
    await expect(approveEnrollment(other, e.id)).rejects.toMatchObject({ httpStatus: 403 });
  });
});

describe('bulk enroll (FR-ENROLL-03)', () => {
  it('enrolls by email, skips duplicates, reports not-found', async () => {
    const courseId = await makeCourse(institutionId, instructor.userId);
    const a = await UserModel.create({ institutionId, email: 'a@x.com', fullName: 'A', role: 'student', status: 'active' });
    await UserModel.create({ institutionId, email: 'b@x.com', fullName: 'B', role: 'student', status: 'active' });
    // Pre-enroll a to test skip.
    await enrollSelf({ userId: String(a._id), institutionId, role: 'student' }, courseId);

    const result = await bulkEnroll(instructor, courseId, {
      studentEmails: ['a@x.com', 'b@x.com', 'ghost@x.com'],
    });
    expect(result.enrolled).toBe(1); // only b
    expect(result.skipped).toBe(1); // a already enrolled
    expect(result.notFound).toContain('ghost@x.com');

    const roster = await listRoster(instructor, courseId, { page: 1, pageSize: 50 });
    expect(roster.total).toBe(2);
  });
});

describe('drop / withdraw (FR-ENROLL-05)', () => {
  it('student can withdraw themselves', async () => {
    const student = await makeUser(institutionId, 'student');
    const courseId = await makeCourse(institutionId, instructor.userId);
    const e = await enrollSelf(student, courseId);
    const dropped = await dropEnrollment(student, e.id, {});
    expect(dropped.status).toBe('dropped');
  });

  it('staff withdrawal requires a reason (audited)', async () => {
    const student = await makeUser(institutionId, 'student');
    const courseId = await makeCourse(institutionId, instructor.userId);
    const e = await enrollSelf(student, courseId);
    await expect(dropEnrollment(instructor, e.id, {})).rejects.toMatchObject({ httpStatus: 400 });
    const dropped = await dropEnrollment(instructor, e.id, { reason: 'Inactive for 30 days' });
    expect(dropped.status).toBe('dropped');
    expect(dropped.droppedReason).toBe('Inactive for 30 days');
  });

  it('re-enrollment after dropping is allowed', async () => {
    const student = await makeUser(institutionId, 'student');
    const courseId = await makeCourse(institutionId, instructor.userId);
    const e = await enrollSelf(student, courseId);
    await dropEnrollment(student, e.id, {});
    const again = await enrollSelf(student, courseId);
    expect(again.status).toBe('active');
    expect(again.id).toBe(e.id); // reuses the same record (unique index)
  });
});

describe('my enrollments + tenant isolation (FR-ENROLL-04)', () => {
  it('lists a student’s own enrollments with course info', async () => {
    const student = await makeUser(institutionId, 'student');
    const courseId = await makeCourse(institutionId, instructor.userId);
    await enrollSelf(student, courseId);
    const mine = await getMyEnrollments(student, {});
    expect(mine.enrollments).toHaveLength(1);
    expect(mine.enrollments[0]!.course?.id).toBe(courseId);
  });

  it('cannot enroll in a course from another institution', async () => {
    const otherInst = await makeInstitution('other');
    const otherInstructor = await makeUser(otherInst, 'instructor');
    const otherCourse = await makeCourse(otherInst, otherInstructor.userId);
    const student = await makeUser(institutionId, 'student');
    await expect(enrollSelf(student, otherCourse)).rejects.toMatchObject({ httpStatus: 404 });
  });
});
