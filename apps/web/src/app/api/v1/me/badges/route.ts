import { listMyBadges } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/me/badges — current user's badges and points (FR-DASH-02). */
export const GET = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'] },
  async ({ ctx }) => ok(await listMyBadges(ctx!)),
);
