import type { FilterQuery } from 'mongoose';
import { UserModel, type User } from '../models/user.model';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../errors';
import type { AuthContext } from '../rbac/roles';
import type {
  AdminChangeRoleInput,
  AdminCreateUserInput,
  AdminListUsersInput,
  UpdateMeInput,
} from '../schemas/user.schema';
import { hashPassword } from './password';
import { toPublicUser, type PublicUser } from './serialize';
import { writeAudit } from './audit.service';
import { InstitutionModel } from '../models/institution.model';

/** GET /users/me. */
export async function getMe(ctx: AuthContext): Promise<PublicUser> {
  const [user, institution] = await Promise.all([
    UserModel.findById(ctx.userId),
    InstitutionModel.findById(ctx.institutionId).select('featureFlags'),
  ]);
  if (!user) throw NotFoundError('User not found.');
  const publicUser = toPublicUser(user);
  if (institution?.featureFlags) {
    publicUser.institutionFeatureFlags = {
      nativeLiveClassroom: institution.featureFlags.nativeLiveClassroom ?? false,
      zoomIntegration: institution.featureFlags.zoomIntegration ?? false,
      teamsIntegration: institution.featureFlags.teamsIntegration ?? false,
      alumniPortal: institution.featureFlags.alumniPortal ?? true,
      gamification: institution.featureFlags.gamification ?? true,
    };
  }
  return publicUser;
}

/** GET /users/{id} — within the caller's institution only (tenant isolation). */
export async function getUserById(ctx: AuthContext, userId: string): Promise<PublicUser> {
  const user = await UserModel.findOne({ _id: userId, institutionId: ctx.institutionId });
  if (!user) throw NotFoundError('User not found.');
  return toPublicUser(user);
}

/** PATCH /users/me. */
export async function updateMe(ctx: AuthContext, input: UpdateMeInput): Promise<PublicUser> {
  const user = await UserModel.findById(ctx.userId);
  if (!user) throw NotFoundError('User not found.');

  if (input.fullName !== undefined) user.fullName = input.fullName;
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
  if (input.locale !== undefined) user.locale = input.locale;
  if (input.notificationPreferences) {
    user.notificationPreferences = {
      email: input.notificationPreferences.email ?? user.notificationPreferences?.email ?? true,
      sms: input.notificationPreferences.sms ?? user.notificationPreferences?.sms ?? false,
      inApp: input.notificationPreferences.inApp ?? user.notificationPreferences?.inApp ?? true,
    };
  }
  await user.save();
  return toPublicUser(user);
}

/** Admin: list/query users within the institution (FR-ADMIN-01). */
export async function adminListUsers(
  ctx: AuthContext,
  input: AdminListUsersInput,
): Promise<{ users: PublicUser[]; total: number; page: number; pageSize: number }> {
  const filter: FilterQuery<User> = { institutionId: ctx.institutionId };
  if (input.role) filter.role = input.role;
  if (input.status) filter.status = input.status;
  if (input.q) {
    filter.$or = [
      { fullName: { $regex: input.q, $options: 'i' } },
      { email: { $regex: input.q, $options: 'i' } },
    ];
  }

  const [docs, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((input.page - 1) * input.pageSize)
      .limit(input.pageSize),
    UserModel.countDocuments(filter),
  ]);

  return {
    users: docs.map(toPublicUser),
    total,
    page: input.page,
    pageSize: input.pageSize,
  };
}

/** Admin: create a user within the institution (FR-ADMIN-01, audited). */
export async function adminCreateUser(
  ctx: AuthContext,
  input: AdminCreateUserInput,
): Promise<PublicUser> {
  const email = input.email.toLowerCase().trim();
  const existing = await UserModel.findOne({ institutionId: ctx.institutionId, email })
    .select('_id')
    .lean();
  if (existing) throw ConflictError('Email is already registered.');

  const user = await UserModel.create({
    institutionId: ctx.institutionId,
    email,
    fullName: input.fullName,
    role: input.role,
    passwordHash: input.password ? await hashPassword(input.password) : undefined,
    // Admin-created accounts are active immediately; password can be set via reset.
    status: 'active',
    emailVerifiedAt: new Date(),
  });

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'user.create',
    targetEntity: { type: 'user', id: user._id },
    after: { email, role: input.role },
  });
  return toPublicUser(user);
}

/** Admin: change a user's role (FR-ADMIN-01, FR-ADMIN-02 audited before/after). */
export async function adminChangeRole(
  ctx: AuthContext,
  targetUserId: string,
  input: AdminChangeRoleInput,
): Promise<PublicUser> {
  const user = await UserModel.findOne({
    _id: targetUserId,
    institutionId: ctx.institutionId,
  });
  if (!user) throw NotFoundError('User not found.');
  if (String(user._id) === ctx.userId) {
    throw ValidationError('You cannot change your own role.');
  }

  const before = user.role;
  if (before === input.role) return toPublicUser(user);

  user.role = input.role;
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // force re-auth with new role
  await user.save();

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'user.role_change',
    targetEntity: { type: 'user', id: user._id },
    before: { role: before },
    after: { role: input.role },
  });
  return toPublicUser(user);
}

/** Admin: deactivate a user (soft, preserves referential integrity — DDD §7). */
export async function adminDeactivateUser(
  ctx: AuthContext,
  targetUserId: string,
): Promise<PublicUser> {
  const user = await UserModel.findOne({
    _id: targetUserId,
    institutionId: ctx.institutionId,
  });
  if (!user) throw NotFoundError('User not found.');
  if (String(user._id) === ctx.userId) {
    throw ValidationError('You cannot deactivate your own account.');
  }
  if (user.role === 'super_admin') {
    throw ForbiddenError('Super Admin accounts cannot be deactivated here.');
  }

  const before = user.status;
  user.status = 'deactivated';
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // revoke sessions
  await user.save();

  await writeAudit({
    institutionId: ctx.institutionId,
    actorId: ctx.userId,
    actorRole: ctx.role,
    action: 'user.deactivate',
    targetEntity: { type: 'user', id: user._id },
    before: { status: before },
    after: { status: 'deactivated' },
  });
  return toPublicUser(user);
}
