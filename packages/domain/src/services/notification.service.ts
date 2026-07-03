import mongoose from 'mongoose';
import { NotificationModel } from '../models/notification.model';
import { CourseModel } from '../models/course.model';
import { EnrollmentModel } from '../models/enrollment.model';
import { UserModel } from '../models/user.model';
import { ForbiddenError, NotFoundError } from '../errors';
import { hasAnyRole, type AuthContext } from '../rbac/roles';
import type { NotificationType } from '@lumora/config';
import type {
  CreateAnnouncementInput,
  ListNotificationsInput,
} from '../schemas/notification.schema';

const { Types } = mongoose;

interface NotifyUserInput {
  institutionId: string;
  userId: string | unknown;
  type: NotificationType;
  title: string;
  body?: string;
  actionUrl?: string;
  relatedEntity?: { type: string; id: unknown };
}

export async function notifyUser(input: NotifyUserInput) {
  const user = await UserModel.findOne({
    _id: input.userId,
    institutionId: input.institutionId,
  }).select('notificationPreferences');
  if (!user) return null;

  const inAppEnabled = user.notificationPreferences?.inApp ?? true;
  const emailEnabled = user.notificationPreferences?.email ?? true;

  return NotificationModel.create({
    institutionId: input.institutionId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? '',
    actionUrl: input.actionUrl,
    relatedEntity: input.relatedEntity
      ? {
          type: input.relatedEntity.type,
          id: Types.ObjectId.isValid(String(input.relatedEntity.id))
            ? new Types.ObjectId(String(input.relatedEntity.id))
            : undefined,
        }
      : undefined,
    channels: {
      inApp: inAppEnabled ? 'sent' : 'skipped',
      email: emailEnabled ? 'pending' : 'skipped',
    },
  });
}

export async function listNotifications(ctx: AuthContext, input: ListNotificationsInput) {
  const filter: Record<string, unknown> = {
    institutionId: ctx.institutionId,
    userId: ctx.userId,
  };
  if (input.unreadOnly) filter.readAt = { $exists: false };

  const [items, total, unreadCount] = await Promise.all([
    NotificationModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.pageSize)
      .limit(input.pageSize)
      .lean(),
    NotificationModel.countDocuments(filter),
    NotificationModel.countDocuments({
      institutionId: ctx.institutionId,
      userId: ctx.userId,
      readAt: { $exists: false },
    }),
  ]);

  return {
    notifications: items.map((n) => ({
      id: String(n._id),
      type: n.type,
      title: n.title,
      body: n.body,
      actionUrl: n.actionUrl,
      readAt: n.readAt ?? null,
      createdAt: n.createdAt,
    })),
    unreadCount,
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

export async function markNotificationRead(ctx: AuthContext, notificationId: string) {
  if (!Types.ObjectId.isValid(notificationId)) throw NotFoundError('Notification not found.');
  const notification = await NotificationModel.findOne({
    _id: notificationId,
    institutionId: ctx.institutionId,
    userId: ctx.userId,
  });
  if (!notification) throw NotFoundError('Notification not found.');
  notification.readAt = notification.readAt ?? new Date();
  await notification.save();
  return { id: String(notification._id), readAt: notification.readAt };
}

export async function markAllNotificationsRead(ctx: AuthContext) {
  const result = await NotificationModel.updateMany(
    { institutionId: ctx.institutionId, userId: ctx.userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  return { updated: result.modifiedCount };
}

export async function createCourseAnnouncement(ctx: AuthContext, input: CreateAnnouncementInput) {
  if (!Types.ObjectId.isValid(input.courseId)) throw NotFoundError('Course not found.');
  const course = await CourseModel.findOne({ _id: input.courseId, institutionId: ctx.institutionId });
  if (!course) throw NotFoundError('Course not found.');
  if (!hasAnyRole(ctx.role, ['admin', 'super_admin']) && String(course.instructorId) !== ctx.userId) {
    throw ForbiddenError('You do not manage this course.');
  }

  const enrollments = await EnrollmentModel.find({
    courseId: input.courseId,
    status: { $in: ['active', 'completed'] },
  }).select('studentId');

  // Broadcast fan-out (FR-NOTIFY-05): a large cohort must not turn into N
  // sequential findOne+create round trips inside this request. Preferences for
  // every recipient are fetched in one query and notifications are written with
  // a single bulk insert instead of notifyUser()'s one-at-a-time path.
  const studentIds = enrollments.map((e) => e.studentId);
  const users = await UserModel.find({ _id: { $in: studentIds } }).select('notificationPreferences');
  const prefsById = new Map(users.map((u) => [String(u._id), u.notificationPreferences]));

  const docs = studentIds.map((studentId) => {
    const prefs = prefsById.get(String(studentId));
    return {
      institutionId: ctx.institutionId,
      userId: studentId,
      type: 'announcement' as const,
      title: input.title,
      body: input.body ?? '',
      actionUrl: `/learn/${input.courseId}`,
      relatedEntity: { type: 'course', id: input.courseId },
      channels: {
        inApp: (prefs?.inApp ?? true) ? 'sent' : 'skipped',
        email: (prefs?.email ?? true) ? 'pending' : 'skipped',
      },
    };
  });
  if (docs.length > 0) await NotificationModel.insertMany(docs, { ordered: false });

  return { notified: docs.length };
}

export async function getPendingEmailNotifications(limit = 25) {
  return NotificationModel.find({ 'channels.email': 'pending' })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate<{ userId: { email: string; fullName: string } }>('userId', 'email fullName');
}

export async function markNotificationEmailSent(notificationId: string) {
  await NotificationModel.updateOne(
    { _id: notificationId },
    { $set: { 'channels.email': 'sent', emailSentAt: new Date() }, $unset: { emailError: '' } },
  );
}

export async function markNotificationEmailFailed(notificationId: string, error: string) {
  await NotificationModel.updateOne(
    { _id: notificationId },
    { $set: { 'channels.email': 'failed', emailError: error.slice(0, 1000) } },
  );
}
