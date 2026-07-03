import { getInstructorDashboard } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/dashboard/instructor (FR-DASH-04). */
export const GET = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx }) => ok(await getInstructorDashboard(ctx!)),
);
