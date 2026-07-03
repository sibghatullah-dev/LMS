import { describe, expect, it } from 'vitest';
import { hasAnyRole, hasAtLeastRole, requireRole } from './index';
import type { AuthContext } from './roles';
import { DomainError } from '../errors';

const ctx = (role: AuthContext['role']): AuthContext => ({
  userId: 'u1',
  institutionId: 'i1',
  role,
});

describe('rbac', () => {
  it('ranks roles by privilege', () => {
    expect(hasAtLeastRole('admin', 'instructor')).toBe(true);
    expect(hasAtLeastRole('student', 'instructor')).toBe(false);
    expect(hasAtLeastRole('super_admin', 'super_admin')).toBe(true);
  });

  it('checks explicit role membership', () => {
    expect(hasAnyRole('instructor', ['instructor', 'admin'])).toBe(true);
    expect(hasAnyRole('student', ['instructor', 'admin'])).toBe(false);
  });

  it('requireRole throws 401 when unauthenticated and 403 when disallowed', () => {
    expect(() => requireRole(null, ['admin'])).toThrow(DomainError);
    try {
      requireRole(null, ['admin']);
    } catch (e) {
      expect((e as DomainError).httpStatus).toBe(401);
    }
    try {
      requireRole(ctx('student'), ['admin']);
    } catch (e) {
      expect((e as DomainError).httpStatus).toBe(403);
    }
  });

  it('requireRole passes for an allowed role', () => {
    expect(() => requireRole(ctx('admin'), ['admin', 'super_admin'])).not.toThrow();
  });
});
