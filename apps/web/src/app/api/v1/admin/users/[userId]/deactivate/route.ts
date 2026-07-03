import { adminDeactivateUser } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/admin/users/{userId}/deactivate (FR-ADMIN-01, audited). */
export const POST = defineRoute(
  { roles: ['admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await adminDeactivateUser(ctx!, params.userId!)),
);
