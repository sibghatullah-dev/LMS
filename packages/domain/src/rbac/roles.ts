import type { Role } from '@lumora/config';

/**
 * RBAC foundation (FR-AUTH-04, NFR-SEC-03). Enforced server-side on every route.
 *
 * Two dimensions of authorization (SAD §8):
 *   1. Role level — coarse capability tier (checked here).
 *   2. Resource ownership — e.g. an instructor may only grade submissions in a
 *      course they own (checked per-resource in Phase 2+ services).
 *
 * Phase 0 establishes the role ordering and the auth context shape; the concrete
 * per-resource permission matrix is layered in as each domain module lands.
 */

/** Higher number = broader platform authority. */
const ROLE_RANK: Record<Role, number> = {
  alumnus: 0,
  student: 1,
  instructor: 2,
  admin: 3,
  super_admin: 4,
};

/** The authenticated caller's context, derived from the JWT (Phase 1). */
export interface AuthContext {
  userId: string;
  institutionId: string;
  role: Role;
}

/** True when `role` is at least as privileged as `minimum`. */
export function hasAtLeastRole(role: Role, minimum: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** True when `role` is one of the explicitly allowed roles. */
export function hasAnyRole(role: Role, allowed: readonly Role[]): boolean {
  return allowed.includes(role);
}
