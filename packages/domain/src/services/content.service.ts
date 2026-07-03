import mongoose, { type HydratedDocument } from 'mongoose';
import { LESSON_COMPLETE_THRESHOLD_PERCENT, loadEnv, type LessonProgressStatus } from '@lumora/config';
import { CourseModel, type Course } from '../models/course.model';
import { EnrollmentModel } from '../models/enrollment.model';
import { LessonProgressModel } from '../models/lesson-progress.model';
import { ForbiddenError, NotFoundError, ValidationError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import type { LessonProgressInput, UploadUrlInput } from '../schemas/content.schema';
import { buildStorageKey, presignDownload, presignUpload } from './storage.service';
import { computeModuleLock } from './drip';

const { Types } = mongoose;
const isManager = (ctx: AuthContext) => hasAnyRole(ctx.role, ['admin', 'super_admin']);

async function loadCourse(ctx: AuthContext, courseId: string): Promise<HydratedDocument<Course>> {
  if (!Types.ObjectId.isValid(courseId)) throw NotFoundError('Course not found.');
  const course = await CourseModel.findOne({ _id: courseId, institutionId: ctx.institutionId });
  if (!course) throw NotFoundError('Course not found.');
  return course;
}

function isCourseStaff(ctx: AuthContext, course: HydratedDocument<Course>): boolean {
  return isManager(ctx) || String(course.instructorId) === ctx.userId;
}

/**
 * Access gate for consuming content: course staff always, otherwise an active or
 * completed enrollment (FR-CONTENT-04). Returns the enrollment date for drip math.
 */
async function assertContentAccess(
  ctx: AuthContext,
  course: HydratedDocument<Course>,
): Promise<{ isStaff: boolean; enrolledAt?: Date }> {
  if (isCourseStaff(ctx, course)) return { isStaff: true };
  const enrollment = await EnrollmentModel.findOne({
    courseId: course._id,
    studentId: ctx.userId,
    status: { $in: ['active', 'completed'] },
  });
  if (!enrollment) throw ForbiddenError('Enroll in this course to access its content.');
  return { isStaff: false, enrolledAt: enrollment.enrolledAt ?? undefined };
}

/** FR-CONTENT-02, NFR-SEC-05 — issue a presigned upload URL after validating the file. */
export async function createUploadUrl(ctx: AuthContext, input: UploadUrlInput) {
  const course = await loadCourse(ctx, input.courseId);
  if (!isCourseStaff(ctx, course)) throw ForbiddenError('You do not manage this course.');

  const { MAX_VIDEO_UPLOAD_BYTES, MAX_FILE_UPLOAD_BYTES } = loadEnv();
  const limit = input.kind === 'video' ? MAX_VIDEO_UPLOAD_BYTES : MAX_FILE_UPLOAD_BYTES;
  if (input.sizeBytes > limit) {
    const gb = (limit / 1_073_741_824).toFixed(0);
    const mb = (limit / 1_048_576).toFixed(0);
    throw ValidationError(
      input.kind === 'video'
        ? `This file is larger than ${gb} GB. Compress it or split it into parts.`
        : `This file is larger than ${mb} MB.`,
    );
  }
  // Light MIME sanity check by kind (defense-in-depth alongside the size gate).
  const prefixByKind: Record<string, string> = { video: 'video/', audio: 'audio/' };
  const expected = prefixByKind[input.kind];
  if (expected && !input.mimeType.startsWith(expected)) {
    throw ValidationError(`Expected a ${input.kind} file but got "${input.mimeType}".`);
  }

  const storageKey = buildStorageKey(ctx.institutionId, input.courseId, input.fileName);
  const uploadUrl = await presignUpload(storageKey, input.mimeType);
  return { uploadUrl, storageKey };
}

interface FoundLesson {
  moduleId: string;
  module: NonNullable<Course['modules']>[number];
  lesson: NonNullable<NonNullable<Course['modules']>[number]['lessons']>[number];
}

function findLesson(course: HydratedDocument<Course>, lessonId: string): FoundLesson {
  for (const m of course.modules ?? []) {
    for (const l of m.lessons ?? []) {
      if (String((l as { _id: unknown })._id) === lessonId) {
        return { moduleId: String((m as { _id: unknown })._id), module: m, lesson: l };
      }
    }
  }
  throw NotFoundError('Lesson not found.');
}

/** Player view: module lock state + per-lesson progress + completion summary. */
export async function getCoursePlayer(ctx: AuthContext, courseId: string) {
  const course = await loadCourse(ctx, courseId);
  if (course.status !== 'published' && !isCourseStaff(ctx, course)) {
    throw ForbiddenError('This course is not available.');
  }
  const { isStaff, enrolledAt } = await assertContentAccess(ctx, course);

  const progressDocs = await LessonProgressModel.find({ studentId: ctx.userId, courseId });
  const progressByLesson = new Map(progressDocs.map((p) => [String(p.lessonId), p]));

  let totalLessons = 0;
  let completedLessons = 0;
  const now = new Date();

  const modules = (course.modules ?? []).map((m) => {
    const lock = computeModuleLock(m.releaseRule, enrolledAt, now, isStaff);
    const lessons = (m.lessons ?? []).map((l) => {
      totalLessons++;
      const prog = progressByLesson.get(String((l as { _id: unknown })._id));
      if (prog?.status === 'completed') completedLessons++;
      return {
        id: String((l as { _id: unknown })._id),
        title: l.title,
        order: l.order,
        contentCount: (l.contentItems ?? []).length,
        status: (prog?.status ?? 'not_started') as LessonProgressStatus,
        percentConsumed: prog?.percentConsumed ?? 0,
      };
    });
    return {
      id: String((m as { _id: unknown })._id),
      title: m.title,
      order: m.order,
      locked: lock.locked,
      releaseAt: lock.releaseAt,
      lessons,
    };
  });

  return {
    courseId: String(course._id),
    title: course.title,
    modules,
    progress: {
      totalLessons,
      completedLessons,
      percent: totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100),
    },
  };
}

/** Lesson content with short-lived playback/download URLs (gated by drip + access). */
export async function getLessonContent(ctx: AuthContext, courseId: string, lessonId: string) {
  const course = await loadCourse(ctx, courseId);
  if (course.status !== 'published' && !isCourseStaff(ctx, course)) {
    throw ForbiddenError('This course is not available.');
  }
  const { isStaff, enrolledAt } = await assertContentAccess(ctx, course);
  const { module, lesson } = findLesson(course, lessonId);

  const lock = computeModuleLock(module.releaseRule, enrolledAt, new Date(), isStaff);
  if (lock.locked) {
    throw ForbiddenError(
      lock.releaseAt
        ? `This module unlocks on ${lock.releaseAt.toISOString()}.`
        : 'This module is not yet available.',
    );
  }

  const contentItems = await Promise.all(
    (lesson.contentItems ?? []).map(async (ci) => {
      const item = ci as {
        _id: unknown;
        type: string;
        title: string;
        storageKey?: string;
        textBody?: string;
        durationSeconds?: number;
      };
      return {
        id: String(item._id),
        type: item.type,
        title: item.title,
        textBody: item.textBody,
        durationSeconds: item.durationSeconds,
        // Short-lived signed URL for media/document content (FR-CONTENT-01/04).
        url: item.storageKey ? await presignDownload(item.storageKey) : undefined,
      };
    }),
  );

  return { id: lessonId, title: lesson.title, contentItems };
}

/** FR-CONTENT-03 — record consumption and derive completion. */
export async function upsertLessonProgress(
  ctx: AuthContext,
  courseId: string,
  lessonId: string,
  input: LessonProgressInput,
) {
  const course = await loadCourse(ctx, courseId);
  // Only enrolled students track progress (staff previews don't).
  const enrollment = await EnrollmentModel.findOne({
    courseId,
    studentId: ctx.userId,
    status: { $in: ['active', 'completed'] },
  });
  if (!enrollment) throw ForbiddenError('Enroll in this course to track progress.');

  const { moduleId } = findLesson(course, lessonId);

  const existing = await LessonProgressModel.findOne({ studentId: ctx.userId, lessonId });
  const percent = input.percentConsumed ?? existing?.percentConsumed ?? 0;

  let status: LessonProgressStatus = input.status ?? existing?.status ?? 'not_started';
  if (input.status !== 'completed') {
    if (percent >= LESSON_COMPLETE_THRESHOLD_PERCENT) status = 'completed';
    else if (percent > 0) status = 'in_progress';
  }

  const doc =
    existing ??
    new LessonProgressModel({
      institutionId: ctx.institutionId,
      studentId: ctx.userId,
      courseId,
      moduleId,
      lessonId,
    });
  doc.percentConsumed = percent;
  doc.status = status;
  doc.lastAccessedAt = new Date();
  if (status === 'completed' && !doc.completedAt) doc.completedAt = new Date();
  await doc.save();

  return { lessonId, status: doc.status, percentConsumed: doc.percentConsumed };
}
