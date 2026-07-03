import { eraseAccountSchema, eraseMyAccount } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/me/privacy/erase (NFR-PRIV-01). */
export const POST = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'], body: eraseAccountSchema },
  async ({ ctx, body }) => ok(await eraseMyAccount(ctx!, body.confirmation)),
);
