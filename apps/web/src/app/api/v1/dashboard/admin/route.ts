import { getAdminDashboard } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/dashboard/admin (FR-DASH-05). */
export const GET = defineRoute(
  { roles: ['admin', 'super_admin'] },
  async ({ ctx }) => ok(await getAdminDashboard(ctx!)),
);
