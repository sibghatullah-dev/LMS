import {
  ACCOUNT_LOCK_MINUTES,
  DEFAULT_INSTITUTION_SLUG,
  EMAIL_VERIFICATION_TTL_HOURS,
  MAX_FAILED_LOGIN_ATTEMPTS,
  PASSWORD_RESET_TTL_MINUTES,
  loadEnv,
  type Role,
} from '@lumora/config';
import { InstitutionModel } from '../models/institution.model';
import { UserModel } from '../models/user.model';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
} from '../errors';
import type { EmailPort } from '../ports/email.port';
import { noopEmailPort } from '../ports/email.port';
import type {
  LoginInput,
  PasswordResetConfirmInput,
  PasswordResetRequestInput,
  RegisterInput,
  VerifyEmailInput,
} from '../schemas/auth.schema';
import { hashPassword, verifyPassword } from './password';
import { generateRawToken, hashToken, tokenMatches } from './secure-token';
import { signAccessToken, signRefreshToken } from './token.service';
import { toPublicUser, type PublicUser } from './serialize';
import { writeAudit } from './audit.service';

interface RequestMeta {
  ip?: string;
  emailPort?: EmailPort;
}

async function resolveInstitutionId(slug?: string): Promise<string> {
  const institution = await InstitutionModel.findOne({
    slug: slug ?? DEFAULT_INSTITUTION_SLUG,
  })
    .select('_id')
    .lean();
  if (!institution) {
    throw ValidationError(
      slug ? `Unknown institution "${slug}".` : 'No default institution is configured.',
    );
  }
  return String(institution._id);
}

function minutesFromNow(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000);
}

/** FR-AUTH-01 — register + issue an email-verification token. */
export async function register(
  input: RegisterInput,
  meta: RequestMeta = {},
): Promise<{ user: PublicUser; verificationToken: string }> {
  const institutionId = await resolveInstitutionId(input.institutionSlug);
  const email = input.email.toLowerCase().trim();

  const existing = await UserModel.findOne({ institutionId, email }).select('_id').lean();
  if (existing) throw ConflictError('Email is already registered.');

  const rawToken = generateRawToken();
  const user = await UserModel.create({
    institutionId,
    email,
    passwordHash: await hashPassword(input.password),
    authProviders: ['credentials'],
    fullName: input.fullName,
    role: input.role,
    status: 'pending_verification',
    security: {
      emailVerificationTokenHash: hashToken(rawToken),
      emailVerificationExpiresAt: minutesFromNow(EMAIL_VERIFICATION_TTL_HOURS * 60),
    },
  });

  await sendVerificationEmail(meta.emailPort ?? noopEmailPort, email, String(user._id), rawToken);
  await writeAudit({
    institutionId,
    actorId: user._id,
    actorRole: user.role,
    action: 'auth.register',
    targetEntity: { type: 'user', id: user._id },
    ipAddress: meta.ip,
  });

  return { user: toPublicUser(user), verificationToken: rawToken };
}

/** FR-AUTH-01 — confirm an email-verification token, activating the account. */
export async function verifyEmail(input: VerifyEmailInput): Promise<PublicUser> {
  const user = await UserModel.findById(input.userId);
  if (!user) throw NotFoundError('User not found.');
  if (user.emailVerifiedAt) return toPublicUser(user); // idempotent

  const expires = user.security?.emailVerificationExpiresAt;
  if (
    !tokenMatches(input.token, user.security?.emailVerificationTokenHash) ||
    !expires ||
    expires.getTime() < Date.now()
  ) {
    throw ValidationError('Verification link is invalid or has expired.');
  }

  user.emailVerifiedAt = new Date();
  user.status = 'active';
  if (user.security) {
    user.security.emailVerificationTokenHash = undefined;
    user.security.emailVerificationExpiresAt = undefined;
  }
  await user.save();

  await writeAudit({
    institutionId: user.institutionId,
    actorId: user._id,
    actorRole: user.role,
    action: 'auth.email_verified',
    targetEntity: { type: 'user', id: user._id },
  });
  return toPublicUser(user);
}

/** FR-AUTH-02, FR-AUTH-08 — login with lockout after repeated failures. */
export async function login(
  input: LoginInput,
  meta: RequestMeta = {},
): Promise<{ user: PublicUser; accessToken: string; refreshToken: string }> {
  const institutionId = await resolveInstitutionId(input.institutionSlug);
  const email = input.email.toLowerCase().trim();
  const user = await UserModel.findOne({ institutionId, email });

  // Uniform failure to avoid leaking whether the email exists.
  const invalid = () => UnauthenticatedError('Incorrect email or password.');

  if (!user || !user.passwordHash) {
    await writeAudit({
      institutionId,
      action: 'auth.login_failed',
      targetEntity: { type: 'user' },
      ipAddress: meta.ip,
      after: { email, reason: 'no_such_user' },
    });
    throw invalid();
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    throw ForbiddenError('Account is temporarily locked. Try again later.');
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
    if (user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS) {
      user.lockedUntil = minutesFromNow(ACCOUNT_LOCK_MINUTES);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    await writeAudit({
      institutionId,
      actorId: user._id,
      action: 'auth.login_failed',
      targetEntity: { type: 'user', id: user._id },
      ipAddress: meta.ip,
    });
    throw invalid();
  }

  if (user.status === 'pending_verification') {
    throw ForbiddenError('Please verify your email address before signing in.');
  }
  if (user.status === 'suspended' || user.status === 'deactivated') {
    throw ForbiddenError('This account is not active.');
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens(user);
  await writeAudit({
    institutionId,
    actorId: user._id,
    actorRole: user.role,
    action: 'auth.login_success',
    targetEntity: { type: 'user', id: user._id },
    ipAddress: meta.ip,
  });

  return { user: toPublicUser(user), ...tokens };
}

/** FR-AUTH-05 — request a password reset link (silent on unknown email). */
export async function requestPasswordReset(
  input: PasswordResetRequestInput,
  meta: RequestMeta = {},
): Promise<{ resetToken: string | null }> {
  const institutionId = await resolveInstitutionId(input.institutionSlug);
  const email = input.email.toLowerCase().trim();
  const user = await UserModel.findOne({ institutionId, email });
  if (!user) return { resetToken: null }; // do not reveal existence

  const rawToken = generateRawToken();
  user.security = {
    ...user.security,
    passwordResetTokenHash: hashToken(rawToken),
    passwordResetExpiresAt: minutesFromNow(PASSWORD_RESET_TTL_MINUTES),
  };
  await user.save();

  await sendResetEmail(meta.emailPort ?? noopEmailPort, email, String(user._id), rawToken);
  await writeAudit({
    institutionId,
    actorId: user._id,
    action: 'auth.password_reset_requested',
    targetEntity: { type: 'user', id: user._id },
    ipAddress: meta.ip,
  });
  return { resetToken: rawToken };
}

/** FR-AUTH-05 — confirm a reset token and set a new password. */
export async function confirmPasswordReset(input: PasswordResetConfirmInput): Promise<void> {
  const user = await UserModel.findById(input.userId);
  const expires = user?.security?.passwordResetExpiresAt;
  if (
    !user ||
    !tokenMatches(input.token, user.security?.passwordResetTokenHash) ||
    !expires ||
    expires.getTime() < Date.now()
  ) {
    throw ValidationError('Reset link is invalid or has expired.');
  }

  user.passwordHash = await hashPassword(input.newPassword);
  user.tokenVersion = (user.tokenVersion ?? 0) + 1; // invalidate all sessions
  if (user.security) {
    user.security.passwordResetTokenHash = undefined;
    user.security.passwordResetExpiresAt = undefined;
  }
  // A successful reset also clears any active lockout.
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  await user.save();

  await writeAudit({
    institutionId: user.institutionId,
    actorId: user._id,
    action: 'auth.password_reset',
    targetEntity: { type: 'user', id: user._id },
  });
}

/** Exchange a valid refresh token's user for a fresh access + refresh token pair. */
export async function refreshSession(
  userId: string,
  presentedTokenVersion: number,
): Promise<{ accessToken: string; refreshToken: string }> {
  const user = await UserModel.findById(userId);
  if (!user || (user.tokenVersion ?? 0) !== presentedTokenVersion) {
    throw UnauthenticatedError('Session expired. Please sign in again.');
  }
  if (user.status !== 'active') throw ForbiddenError('This account is not active.');
  return issueTokens(user);
}

/** FR-AUTH — logout: bump tokenVersion, revoking all outstanding refresh tokens. */
export async function logout(userId: string): Promise<void> {
  await UserModel.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
}

// --- helpers ---------------------------------------------------------------

async function issueTokens(user: {
  _id: unknown;
  institutionId: unknown;
  role: string;
  email: string;
  tokenVersion?: number;
}) {
  const userId = String(user._id);
  const accessToken = await signAccessToken({
    userId,
    institutionId: String(user.institutionId),
    role: user.role as Role,
    email: user.email,
  });
  const refreshToken = await signRefreshToken({
    userId,
    tokenVersion: user.tokenVersion ?? 0,
  });
  return { accessToken, refreshToken };
}

async function sendVerificationEmail(
  emailPort: EmailPort,
  to: string,
  userId: string,
  rawToken: string,
): Promise<void> {
  const url = `${loadEnv().APP_URL}/verify-email?uid=${userId}&token=${rawToken}`;
  await emailPort.send({
    to,
    subject: 'Verify your Lumora email',
    text: `Verify your email: ${url}`,
    html: `<p>Welcome to Lumora. Verify your email to activate your account:</p><p><a href="${url}">Verify email</a></p>`,
  });
}

async function sendResetEmail(
  emailPort: EmailPort,
  to: string,
  userId: string,
  rawToken: string,
): Promise<void> {
  const url = `${loadEnv().APP_URL}/reset-password?uid=${userId}&token=${rawToken}`;
  await emailPort.send({
    to,
    subject: 'Reset your Lumora password',
    text: `Reset your password: ${url}`,
    html: `<p>We received a request to reset your password.</p><p><a href="${url}">Reset password</a></p><p>If you didn't request this, you can ignore this email.</p>`,
  });
}
