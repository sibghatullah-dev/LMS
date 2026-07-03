import type { Role } from '@lumora/config';
import { ForbiddenError, UnauthenticatedError } from '../errors';
import { hasAnyRole, hasAtLeastRole, type AuthContext } from './roles';

export * from './roles';
// Re-export the role catalog + type so consumers can depend on the domain facade
// alone rather than reaching into @lumora/config directly.
export { ROLES } from '@lumora/config';
export type { Role } from '@lumora/config';

/**
 * Assert the caller is authenticated and holds at least one of `allowedRoles`.
 * Throws a DomainError that the API boundary maps to 401/403.
 */
export function requireRole(
  ctx: AuthContext | null | undefined,
  allowedRoles: readonly Role[],
): asserts ctx is AuthContext {
  if (!ctx) throw UnauthenticatedError();
  if (!hasAnyRole(ctx.role, allowedRoles)) {
    throw ForbiddenError();
  }
}

/** Assert the caller holds at least the given minimum role tier. */
export function requireMinRole(
  ctx: AuthContext | null | undefined,
  minimum: Role,
): asserts ctx is AuthContext {
  if (!ctx) throw UnauthenticatedError();
  if (!hasAtLeastRole(ctx.role, minimum)) {
    throw ForbiddenError();
  }
}
