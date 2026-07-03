import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { InstitutionModel } from '../src/models/institution.model';
import { UserModel } from '../src/models/user.model';
import { CourseModel } from '../src/models/course.model';
import { EnrollmentModel } from '../src/models/enrollment.model';
import { LessonProgressModel } from '../src/models/lesson-progress.model';
import { createUploadUrl, getCoursePlayer, getLessonContent, upsertLessonProgress } from '../src/services/content.service';
import { computeModuleLock } from '../src/services/drip';
import { enrollSelf } from '../src/services/enrollment.service';
import type { AuthContext } from '../src/rbac/roles';

async function makeInstitution() {
  const inst = await InstitutionModel.create({ name: 'lumora', slug: 'lumora' });
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

/** Build a published course with one immediate module (2 lessons) and one offset-locked module. */
async function makeCourse(institutionId: string, instructorId: string) {
  const c = await CourseModel.create({
    institutionId,
    instructorId,
    title: `Course ${seq++}`,
    slug: `course-${seq}`,
    status: 'published',
    enrollmentMode: 'open',
    modules: [
      {
        title: 'M1',
        order: 0,
        releaseRule: { type: 'immediate' },
        lessons: [
          { title: 'L1', order: 0, contentItems: [{ type: 'article', title: 'Read', textBody: 'hi', order: 0 }] },
          { title: 'L2', order: 1, contentItems: [] },
        ],
      },
      {
        title: 'M2 (locked)',
        order: 1,
        releaseRule: { type: 'offset_from_enrollment', offsetDays: 7 },
        lessons: [{ title: 'L3', order: 0, contentItems: [] }],
      },
    ],
  });
  return c;
}

let institutionId: string;
let instructor: AuthContext;

beforeAll(async () => {
  await Promise.all([EnrollmentModel.createIndexes(), LessonProgressModel.createIndexes()]);
});
beforeEach(async () => {
  institutionId = await makeInstitution();
  instructor = await makeUser(institutionId, 'instructor');
});

describe('drip logic (FR-COURSE-06)', () => {
  it('immediate is always unlocked; offset locks until N days after enrollment', () => {
    const enrolledAt = new Date('2026-01-01T00:00:00Z');
    expect(computeModuleLock({ type: 'immediate' }, enrolledAt, new Date()).locked).toBe(false);

    const rule = { type: 'offset_from_enrollment', offsetDays: 7 };
    const day3 = new Date('2026-01-04T00:00:00Z');
    const day8 = new Date('2026-01-09T00:00:00Z');
    expect(computeModuleLock(rule, enrolledAt, day3).locked).toBe(true);
    expect(computeModuleLock(rule, enrolledAt, day8).locked).toBe(false);
    // Staff bypass the gate.
    expect(computeModuleLock(rule, enrolledAt, day3, true).locked).toBe(false);
  });
});

describe('upload validation (FR-CONTENT-02, NFR-SEC-05)', () => {
  it('rejects an oversized video and a mismatched mime type', async () => {
    const course = await makeCourse(institutionId, instructor.userId);
    const cid = String(course._id);
    await expect(
      createUploadUrl(instructor, {
        courseId: cid,
        fileName: 'big.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 3_000_000_000, // > 2 GB
        kind: 'video',
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });

    await expect(
      createUploadUrl(instructor, {
        courseId: cid,
        fileName: 'not-a-video.txt',
        mimeType: 'text/plain',
        sizeBytes: 100,
        kind: 'video',
      }),
    ).rejects.toMatchObject({ httpStatus: 400 });
  });

  it('returns a presigned URL + storage key for a valid file (owner only)', async () => {
    const course = await makeCourse(institutionId, instructor.userId);
    const res = await createUploadUrl(instructor, {
      courseId: String(course._id),
      fileName: 'lecture.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 50_000_000,
      kind: 'video',
    });
    expect(res.uploadUrl).toContain('http');
    expect(res.storageKey).toContain('courses/');

    const stranger = await makeUser(institutionId, 'instructor');
    await expect(
      createUploadUrl(stranger, {
        courseId: String(course._id),
        fileName: 'x.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 100,
        kind: 'video',
      }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });
});

describe('player access + progress (FR-CONTENT-03/04)', () => {
  it('denies content to non-enrolled students and allows enrolled ones', async () => {
    const course = await makeCourse(institutionId, instructor.userId);
    const cid = String(course._id);
    const student = await makeUser(institutionId, 'student');

    await expect(getCoursePlayer(student, cid)).rejects.toMatchObject({ httpStatus: 403 });

    await enrollSelf(student, cid);
    const player = await getCoursePlayer(student, cid);
    expect(player.progress.totalLessons).toBe(3);
    expect(player.modules[0]!.locked).toBe(false);
    expect(player.modules[1]!.locked).toBe(true); // offset-locked
  });

  it('blocks reading a locked module’s lesson content', async () => {
    const course = await makeCourse(institutionId, instructor.userId);
    const cid = String(course._id);
    const student = await makeUser(institutionId, 'student');
    await enrollSelf(student, cid);

    const lockedLessonId = String((course.modules![1]!.lessons![0] as { _id: unknown })._id);
    await expect(getLessonContent(student, cid, lockedLessonId)).rejects.toMatchObject({
      httpStatus: 403,
    });

    const openLessonId = String((course.modules![0]!.lessons![0] as { _id: unknown })._id);
    const content = await getLessonContent(student, cid, openLessonId);
    expect(content.contentItems[0]!.type).toBe('article');
  });

  it('tracks progress and auto-completes past the threshold, updating the summary', async () => {
    const course = await makeCourse(institutionId, instructor.userId);
    const cid = String(course._id);
    const lessonId = String((course.modules![0]!.lessons![0] as { _id: unknown })._id);
    const student = await makeUser(institutionId, 'student');
    await enrollSelf(student, cid);

    const p1 = await upsertLessonProgress(student, cid, lessonId, { percentConsumed: 40 });
    expect(p1.status).toBe('in_progress');

    const p2 = await upsertLessonProgress(student, cid, lessonId, { percentConsumed: 98 });
    expect(p2.status).toBe('completed');

    const player = await getCoursePlayer(student, cid);
    expect(player.progress.completedLessons).toBe(1);
  });

  it('does not let a non-enrolled student write progress', async () => {
    const course = await makeCourse(institutionId, instructor.userId);
    const cid = String(course._id);
    const lessonId = String((course.modules![0]!.lessons![0] as { _id: unknown })._id);
    const stranger = await makeUser(institutionId, 'student');
    await expect(
      upsertLessonProgress(stranger, cid, lessonId, { percentConsumed: 10 }),
    ).rejects.toMatchObject({ httpStatus: 403 });
  });
});
