import mongoose from 'mongoose';
import { CourseModel } from '../models/course.model';
import { NotFoundError } from '../errors';
import type { AuthContext } from '../rbac/roles';
import { assertTransition } from './course-state';
import { toCourseCard, toPublicCourse, type PublicCourse } from './course-serialize';
import { writeAudit } from './audit.service';
import { notifyUser } from './notification.service';

const { Types } = mongoose;

/**
 * Admin course-approval workflow (UC-03, FR-COURSE-07/08, FR-ADMIN-02).
 * All operations are institution-scoped and write to the immutable audit log.
 */

/** GET the pending-review queue for the admin's institution. */
export async function listPendingReview(ctx: AuthContext) {
  const docs = await CourseModel.find({
    institutionId: ctx.institutionId,
    status: 'pending_review',
  }).sort({ updatedAt: 1 }); // oldest first — fairest review order
  return { courses: docs.map(toCourseCard) };
}

async function loadPending(ctx: AuthContext, courseId: string) {
  const course = await CourseModel.findOne({
    _id: courseId,
    institutionId: ctx.institutionId,
  });
  if (!course) throw NotFoundError('Course not found.');
  return course;
}

/** Approve → published (audited as course.publish). */
export async function approveCourse(ctx: AuthContext, courseId: string): Promise<PublicCourse> {
  const course = await loadPending(ctx, courseId);
  assertTransition(course.status, 'published');

  course.status = 'published';
  course.reviewedBy = new Types.ObjectId(ctx.userId) as unknown as typeof course.reviewedBy;
  course.reviewComment = undefined;
  course.publishedAt = new Date();
  course.version = (course.version ?? 1) + 1;
  await course.save();

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'course.publish',
    targetEntity: { type: 'course', id: course._id },
    after: { status: 'published', version: course.version },
  });
  await notifyUser({
    institutionId: ctx.institutionId,
    userId: course.instructorId,
    type: 'course_review',
    title: 'Course approved',
    body: `${course.title} is now published.`,
    actionUrl: `/instructor/courses/${String(course._id)}`,
    relatedEntity: { type: 'course', id: course._id },
  });
  return toPublicCourse(course);
}

/** Reject → back to draft with a required comment (audited as course.reject). */
export async function rejectCourse(
  ctx: AuthContext,
  courseId: string,
  comment: string,
): Promise<PublicCourse> {
  const course = await loadPending(ctx, courseId);
  assertTransition(course.status, 'draft');

  course.status = 'draft';
  course.reviewedBy = new Types.ObjectId(ctx.userId) as unknown as typeof course.reviewedBy;
  course.reviewComment = comment;
  await course.save();

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'course.reject',
    targetEntity: { type: 'course', id: course._id },
    after: { status: 'draft', reviewComment: comment },
  });
  await notifyUser({
    institutionId: ctx.institutionId,
    userId: course.instructorId,
    type: 'course_review',
    title: 'Course returned for revision',
    body: comment,
    actionUrl: `/instructor/courses/${String(course._id)}`,
    relatedEntity: { type: 'course', id: course._id },
  });
  return toPublicCourse(course);
}
