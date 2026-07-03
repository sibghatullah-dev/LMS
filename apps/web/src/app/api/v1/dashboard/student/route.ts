import { getStudentDashboard } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/dashboard/student (FR-DASH-01). */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx }) => ok(await getStudentDashboard(ctx!)),
);
