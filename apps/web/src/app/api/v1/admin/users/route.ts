import {
  adminCreateUser,
  adminCreateUserSchema,
  adminListUsers,
  adminListUsersSchema,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

const ADMIN_ROLES = ['admin', 'super_admin'] as const;

/** GET /api/v1/admin/users — list/query users in the institution (FR-ADMIN-01). */
export const GET = defineRoute(
  { roles: ADMIN_ROLES, query: adminListUsersSchema },
  async ({ ctx, query }) => ok(await adminListUsers(ctx!, query)),
);

/** POST /api/v1/admin/users — create a user (FR-ADMIN-01). */
export const POST = defineRoute(
  { roles: ADMIN_ROLES, body: adminCreateUserSchema },
  async ({ ctx, body }) => ok(await adminCreateUser(ctx!, body), 201),
);
