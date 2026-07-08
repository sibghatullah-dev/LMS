import mongoose from 'mongoose';
import {
  BadgeModel,
  CourseModel,
  EnrollmentModel,
  PointEventModel,
  UserBadgeModel,
  UserModel,
} from '../models';
import { ForbiddenError, NotFoundError } from '../errors';
import type { AuthContext } from '../rbac/roles';
import type {
  GamificationPreferencesInput,
  LeaderboardQueryInput,
} from '../schemas/gamification.schema';
import { notifyUser } from './notification.service';

const { Types } = mongoose;

const COURSE_COMPLETION_BADGE_CODE = 'course_completion';
const COURSE_COMPLETION_POINTS = 100;

export interface PublicBadgeAward {
  id: string;
  badge: {
    id: string;
    code: string;
    name: string;
    description: string;
    icon: string;
    points: number;
  };
  courseId?: string;
  awardedAt: Date;
}

async function ensureCompletionBadge(institutionId: string) {
  return BadgeModel.findOneAndUpdate(
    { institutionId, code: COURSE_COMPLETION_BADGE_CODE },
    {
      $setOnInsert: {
        institutionId,
        code: COURSE_COMPLETION_BADGE_CODE,
        name: 'Course Completer',
        description: 'Completed a course and earned a certificate.',
        icon: 'award',
        points: COURSE_COMPLETION_POINTS,
      },
    },
    { upsert: true, new: true },
  );
}

export async function awardCourseCompletion(studentId: string, courseId: string): Promise<void> {
  const [course, student] = await Promise.all([
    CourseModel.findById(courseId).select('institutionId title'),
    UserModel.findById(studentId).select('institutionId gamification notificationPreferences'),
  ]);
  if (!course || !student) return;
  const institutionId = String(course.institutionId);
  const badge = await ensureCompletionBadge(institutionId);

  const pointDedupeKey = `course-completion:${courseId}:${studentId}`;
  const pointResult = await PointEventModel.updateOne(
    { dedupeKey: pointDedupeKey },
    {
      $setOnInsert: {
        institutionId,
        userId: studentId,
        courseId,
        reason: 'course_completion',
        points: COURSE_COMPLETION_POINTS,
        dedupeKey: pointDedupeKey,
      },
    },
    { upsert: true },
  );

  const badgeResult = await UserBadgeModel.updateOne(
    { userId: studentId, badgeId: badge._id, courseId },
    {
      $setOnInsert: {
        institutionId,
        userId: studentId,
        badgeId: badge._id,
        courseId,
        awardedAt: new Date(),
      },
    },
    { upsert: true },
  );

  if (pointResult.upsertedCount > 0) {
    await UserModel.updateOne(
      { _id: studentId, institutionId },
      { $inc: { 'gamification.totalPoints': COURSE_COMPLETION_POINTS } },
    );
  }

  if (badgeResult.upsertedCount > 0) {
    await notifyUser({
      institutionId,
      userId: studentId,
      type: 'announcement',
      title: 'Badge earned',
      body: `You earned the Course Completer badge for ${course.title}.`,
      actionUrl: '/badges',
      relatedEntity: { type: 'badge', id: badge._id },
    });
  }
}

export async function listMyBadges(ctx: AuthContext): Promise<{
  totalPoints: number;
  leaderboardOptOut: boolean;
  badges: PublicBadgeAward[];
}> {
  const [user, awards] = await Promise.all([
    UserModel.findOne({ _id: ctx.userId, institutionId: ctx.institutionId }).select('gamification'),
    UserBadgeModel.find({ institutionId: ctx.institutionId, userId: ctx.userId })
      .sort({ awardedAt: -1 })
      .populate('badgeId'),
  ]);
  if (!user) throw NotFoundError('User not found.');

  return {
    totalPoints: user.gamification?.totalPoints ?? 0,
    leaderboardOptOut: user.gamification?.leaderboardOptOut ?? false,
    badges: awards.map((award) => {
      const badge = award.badgeId as unknown as {
        _id: unknown;
        code: string;
        name: string;
        description?: string;
        icon?: string;
        points?: number;
      };
      return {
        id: String(award._id),
        badge: {
          id: String(badge._id),
          code: badge.code,
          name: badge.name,
          description: badge.description ?? '',
          icon: badge.icon ?? 'award',
          points: badge.points ?? 0,
        },
        courseId: award.courseId ? String(award.courseId) : undefined,
        awardedAt: award.awardedAt,
      };
    }),
  };
}

export async function updateGamificationPreferences(
  ctx: AuthContext,
  input: GamificationPreferencesInput,
) {
  const user = await UserModel.findOneAndUpdate(
    { _id: ctx.userId, institutionId: ctx.institutionId },
    { $set: { 'gamification.leaderboardOptOut': input.leaderboardOptOut } },
    { new: true },
  ).select('gamification');
  if (!user) throw NotFoundError('User not found.');
  return {
    totalPoints: user.gamification?.totalPoints ?? 0,
    leaderboardOptOut: user.gamification?.leaderboardOptOut ?? false,
  };
}

export async function getCourseLeaderboard(
  ctx: AuthContext,
  courseId: string,
  input: LeaderboardQueryInput,
) {
  if (!Types.ObjectId.isValid(courseId)) throw NotFoundError('Course not found.');
  const course = await CourseModel.findOne({ _id: courseId, institutionId: ctx.institutionId }).select('_id');
  if (!course) throw NotFoundError('Course not found.');

  const enrollment = await EnrollmentModel.exists({
    institutionId: ctx.institutionId,
    courseId,
    studentId: ctx.userId,
    status: { $in: ['active', 'completed'] },
  });
  const ownsCourse = await CourseModel.exists({
    _id: courseId,
    institutionId: ctx.institutionId,
    instructorId: ctx.userId,
  });
  const staff = ['admin', 'super_admin'].includes(ctx.role);
  if (!enrollment && !ownsCourse && !staff) throw ForbiddenError('You do not have access to this leaderboard.');

  const rows = await PointEventModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    points: number;
    user: { fullName: string; gamification?: { leaderboardOptOut?: boolean } }[];
  }>([
    { $match: { institutionId: new Types.ObjectId(ctx.institutionId), courseId: new Types.ObjectId(courseId) } },
    { $group: { _id: '$userId', points: { $sum: '$points' } } },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user',
      },
    },
    { $match: { 'user.gamification.leaderboardOptOut': { $ne: true } } },
    { $sort: { points: -1 } },
    { $skip: (input.page - 1) * input.pageSize },
    { $limit: input.pageSize },
  ]);

  return {
    courseId,
    page: input.page,
    pageSize: input.pageSize,
    leaderboard: rows.map((row, index) => ({
      rank: (input.page - 1) * input.pageSize + index + 1,
      userId: String(row._id),
      fullName: row.user[0]?.fullName ?? 'Learner',
      points: row.points,
    })),
  };
}
