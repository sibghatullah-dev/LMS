import { adminChangeRole, adminChangeRoleSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** PATCH /api/v1/admin/users/{userId}/role (FR-ADMIN-01, audited). */
export const PATCH = defineRoute(
  { roles: ['admin', 'super_admin'], body: adminChangeRoleSchema },
  async ({ ctx, body, params }) => ok(await adminChangeRole(ctx!, params.userId!, body)),
);
