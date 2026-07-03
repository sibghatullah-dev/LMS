import { ROLES, getMe, updateMe, updateMeSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/users/me — current user's profile. */
export const GET = defineRoute({ roles: ROLES }, async ({ ctx }) => {
  return ok(await getMe(ctx!));
});

/** PATCH /api/v1/users/me — update own profile & preferences. */
export const PATCH = defineRoute({ roles: ROLES, body: updateMeSchema }, async ({ ctx, body }) => {
  return ok(await updateMe(ctx!, body));
});
