import { AuditLogModel } from '../models/audit-log.model';
import { CertificateModel } from '../models/certificate.model';
import { EnrollmentModel } from '../models/enrollment.model';
import { LessonProgressModel } from '../models/lesson-progress.model';
import { NotificationModel } from '../models/notification.model';
import { SubmissionModel } from '../models/submission.model';
import { UserModel } from '../models/user.model';
import { NotFoundError, ValidationError } from '../errors';
import type { AuthContext } from '../rbac/roles';
import { writeAudit } from './audit.service';

/** NFR-PRIV-02 — export a user's institution-scoped personal/academic data. */
export async function exportMyData(ctx: AuthContext) {
  const user = await UserModel.findOne({ _id: ctx.userId, institutionId: ctx.institutionId }).lean();
  if (!user) throw NotFoundError('User not found.');

  const [enrollments, progress, submissions, certificates, notifications, auditEvents] =
    await Promise.all([
      EnrollmentModel.find({ institutionId: ctx.institutionId, studentId: ctx.userId }).lean(),
      LessonProgressModel.find({ institutionId: ctx.institutionId, studentId: ctx.userId }).lean(),
      SubmissionModel.find({ institutionId: ctx.institutionId, studentId: ctx.userId }).lean(),
      CertificateModel.find({ institutionId: ctx.institutionId, studentId: ctx.userId }).lean(),
      NotificationModel.find({ institutionId: ctx.institutionId, userId: ctx.userId }).lean(),
      AuditLogModel.find({ institutionId: ctx.institutionId, actorId: ctx.userId }).lean(),
    ]);

  return {
    exportedAt: new Date().toISOString(),
    user,
    enrollments,
    progress,
    submissions,
    certificates,
    notifications,
    auditEvents,
  };
}

/**
 * NFR-PRIV-01 — erase direct account PII while preserving academic records and
 * referential integrity. This is a deactivation + scrub, not hard deletion.
 */
export async function eraseMyAccount(ctx: AuthContext, confirmation: string) {
  if (confirmation !== 'ERASE') {
    throw ValidationError('Type ERASE to confirm account erasure.');
  }
  const user = await UserModel.findOne({ _id: ctx.userId, institutionId: ctx.institutionId });
  if (!user) throw NotFoundError('User not found.');

  const before = {
    email: user.email,
    fullName: user.fullName,
    status: user.status,
  };
  const scrubbedEmail = `deleted-${String(user._id)}@deleted.lumora.local`;
  user.email = scrubbedEmail;
  user.fullName = 'Deleted user';
  user.avatarUrl = undefined;
  user.passwordHash = undefined;
  user.authProviders = [];
  user.status = 'deactivated';
  user.emailVerifiedAt = undefined;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.notificationPreferences = { email: false, sms: false, inApp: false };
  user.tokenVersion = (user.tokenVersion ?? 0) + 1;
  user.security = {};
  await user.save();

  await NotificationModel.updateMany(
    { institutionId: ctx.institutionId, userId: ctx.userId },
    { $set: { 'channels.email': 'skipped', emailError: 'Account erased' } },
  );

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'privacy.erase',
    targetEntity: { type: 'user', id: user._id },
    before,
    after: { email: scrubbedEmail, fullName: user.fullName, status: user.status },
  });

  return { status: 'deactivated', erasedAt: new Date().toISOString() };
}
