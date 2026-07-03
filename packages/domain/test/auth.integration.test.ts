import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_INSTITUTION_SLUG, MAX_FAILED_LOGIN_ATTEMPTS } from '@lumora/config';
import { InstitutionModel } from '../src/models/institution.model';
import { UserModel } from '../src/models/user.model';
import { AuditLogModel } from '../src/models/audit-log.model';
import {
  confirmPasswordReset,
  login,
  register,
  requestPasswordReset,
  verifyEmail,
} from '../src/services/auth.service';
import { verifyAccessToken, verifyRefreshToken } from '../src/services/token.service';
import { DomainError } from '../src/errors';

async function seedInstitution() {
  const inst = await InstitutionModel.create({
    name: 'Lumora',
    slug: DEFAULT_INSTITUTION_SLUG,
  });
  return String(inst._id);
}

beforeAll(async () => {
  await UserModel.createIndexes(); // ensure unique {institutionId, email}
});

beforeEach(async () => {
  await seedInstitution();
});

describe('registration + email verification', () => {
  it('registers a pending user and issues a verification token', async () => {
    const { user, verificationToken } = await register({
      email: 'Sara@example.com',
      password: 'password123',
      fullName: 'Sara Ahmed',
      role: 'student',
    });
    expect(user.status).toBe('pending_verification');
    expect(user.email).toBe('sara@example.com'); // normalized
    expect(verificationToken).toHaveLength(64);
  });

  it('rejects a duplicate email within the institution', async () => {
    const input = {
      email: 'dup@example.com',
      password: 'password123',
      fullName: 'Dup',
      role: 'student' as const,
    };
    await register(input);
    await expect(register(input)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it('blocks login until the email is verified, then allows it', async () => {
    const { user, verificationToken } = await register({
      email: 'v@example.com',
      password: 'password123',
      fullName: 'V',
      role: 'student',
    });
    await expect(
      login({ email: 'v@example.com', password: 'password123' }),
    ).rejects.toMatchObject({ httpStatus: 403 });

    await verifyEmail({ userId: user.id, token: verificationToken });
    const result = await login({ email: 'v@example.com', password: 'password123' });
    expect(result.user.emailVerified).toBe(true);

    const claims = await verifyAccessToken(result.accessToken);
    expect(claims.userId).toBe(user.id);
    expect(claims.role).toBe('student');
    const refresh = await verifyRefreshToken(result.refreshToken);
    expect(refresh.userId).toBe(user.id);
  });

  it('rejects an invalid verification token', async () => {
    const { user } = await register({
      email: 'bad@example.com',
      password: 'password123',
      fullName: 'Bad',
      role: 'student',
    });
    await expect(verifyEmail({ userId: user.id, token: 'wrong' })).rejects.toBeInstanceOf(
      DomainError,
    );
  });
});

describe('login lockout (FR-AUTH-08)', () => {
  it('locks the account after too many failed attempts', async () => {
    const { user, verificationToken } = await register({
      email: 'lock@example.com',
      password: 'correct-password',
      fullName: 'Lock',
      role: 'student',
    });
    await verifyEmail({ userId: user.id, token: verificationToken });

    for (let i = 0; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
      await expect(
        login({ email: 'lock@example.com', password: 'nope' }),
      ).rejects.toMatchObject({ httpStatus: 401 });
    }

    // Even the correct password is now refused because the account is locked.
    await expect(
      login({ email: 'lock@example.com', password: 'correct-password' }),
    ).rejects.toMatchObject({ httpStatus: 403 });

    const locked = await UserModel.findById(user.id);
    expect(locked?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
  });
});

describe('password reset (FR-AUTH-05)', () => {
  it('resets the password and invalidates existing sessions', async () => {
    const { user, verificationToken } = await register({
      email: 'reset@example.com',
      password: 'old-password',
      fullName: 'Reset',
      role: 'student',
    });
    await verifyEmail({ userId: user.id, token: verificationToken });

    const oldSession = await login({ email: 'reset@example.com', password: 'old-password' });
    const oldRefresh = await verifyRefreshToken(oldSession.refreshToken);

    const { resetToken } = await requestPasswordReset({ email: 'reset@example.com' });
    expect(resetToken).not.toBeNull();
    await confirmPasswordReset({
      userId: user.id,
      token: resetToken!,
      newPassword: 'brand-new-password',
    });

    // Old password no longer works; new one does.
    await expect(
      login({ email: 'reset@example.com', password: 'old-password' }),
    ).rejects.toMatchObject({ httpStatus: 401 });
    const newSession = await login({
      email: 'reset@example.com',
      password: 'brand-new-password',
    });

    // tokenVersion bumped => the old refresh token is now stale.
    const current = await UserModel.findById(user.id);
    expect(current?.tokenVersion).toBe(oldRefresh.tokenVersion + 1);
    expect((await verifyRefreshToken(newSession.refreshToken)).tokenVersion).toBe(
      current?.tokenVersion,
    );
  });

  it('does not reveal whether an email exists', async () => {
    const { resetToken } = await requestPasswordReset({ email: 'ghost@example.com' });
    expect(resetToken).toBeNull();
  });
});

describe('audit trail (FR-AUTH-09)', () => {
  it('records register, verify, and login events', async () => {
    const { user, verificationToken } = await register({
      email: 'audit@example.com',
      password: 'password123',
      fullName: 'Audit',
      role: 'student',
    });
    await verifyEmail({ userId: user.id, token: verificationToken });
    await login({ email: 'audit@example.com', password: 'password123' });

    const actions = (await AuditLogModel.find({ actorId: user.id }).lean()).map((a) => a.action);
    expect(actions).toContain('auth.register');
    expect(actions).toContain('auth.email_verified');
    expect(actions).toContain('auth.login_success');
  });
});
