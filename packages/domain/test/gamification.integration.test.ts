import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  BadgeModel,
  CourseModel,
  EnrollmentModel,
  InstitutionModel,
  PointEventModel,
  UserBadgeModel,
  UserModel,
} from '../src/models';
import {
  awardCourseCompletion,
  getCourseLeaderboard,
  listMyBadges,
  updateGamificationPreferences,
} from '../src/services/gamification.service';
import type { AuthContext } from '../src/rbac/roles';

let seq = 0;

async function makeInstitution(slug: string) {
  const inst = await InstitutionModel.create({ name: slug, slug });
  return String(inst._id);
}

async function makeUser(institutionId: string, role: AuthContext['role']): Promise<AuthContext> {
  const user = await UserModel.create({
    institutionId,
    email: `${role}-${seq++}@x.com`,
    fullName: `${role} ${seq}`,
    role,
    status: 'active',
  });
  return { userId: String(user._id), institutionId, role };
}

async function makeCourse(institutionId: string, instructorId: string) {
  const course = await CourseModel.create({
    institutionId,
    instructorId,
    title: `Gamification Course ${seq++}`,
    slug: `gamification-course-${seq}`,
    status: 'published',
    enrollmentMode: 'open',
    modules: [{ title: 'M1', order: 0, lessons: [] }],
  });
  return String(course._id);
}

async function enroll(institutionId: string, courseId: string, studentId: string) {
  await EnrollmentModel.create({
    institutionId,
    courseId,
    studentId,
    status: 'completed',
  });
}

let institutionId: string;
let instructor: AuthContext;
let student: AuthContext;
let courseId: string;

beforeAll(async () => {
  await Promise.all([
    BadgeModel.createIndexes(),
    UserBadgeModel.createIndexes(),
    PointEventModel.createIndexes(),
  ]);
});

beforeEach(async () => {
  institutionId = await makeInstitution('lumora');
  instructor = await makeUser(institutionId, 'instructor');
  student = await makeUser(institutionId, 'student');
  courseId = await makeCourse(institutionId, instructor.userId);
  await enroll(institutionId, courseId, student.userId);
});

describe('gamification (FR-DASH-02/03)', () => {
  it('awards course-completion points and badge idempotently', async () => {
    await awardCourseCompletion(student.userId, courseId);
    await awardCourseCompletion(student.userId, courseId);

    const user = await UserModel.findById(student.userId).lean();
    expect(user?.gamification?.totalPoints).toBe(100);
    expect(await PointEventModel.countDocuments({ userId: student.userId })).toBe(1);
    expect(await UserBadgeModel.countDocuments({ userId: student.userId })).toBe(1);

    const mine = await listMyBadges(student);
    expect(mine.totalPoints).toBe(100);
    expect(mine.badges[0]!.badge.code).toBe('course_completion');
  });

  it('lists course leaderboard and respects opt-out', async () => {
    const other = await makeUser(institutionId, 'student');
    await enroll(institutionId, courseId, other.userId);
    await awardCourseCompletion(student.userId, courseId);
    await awardCourseCompletion(other.userId, courseId);

    const first = await getCourseLeaderboard(student, courseId, { page: 1, pageSize: 20 });
    expect(first.leaderboard).toHaveLength(2);

    await updateGamificationPreferences(student, { leaderboardOptOut: true });
    const afterOptOut = await getCourseLeaderboard(other, courseId, { page: 1, pageSize: 20 });
    expect(afterOptOut.leaderboard.map((row) => row.userId)).toEqual([other.userId]);
  });
});
