import { ROLES, getUserById } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/users/{userId} — within the caller's institution (tenant-scoped). */
export const GET = defineRoute({ roles: ROLES }, async ({ ctx, params }) => {
  return ok(await getUserById(ctx!, params.userId!));
});
