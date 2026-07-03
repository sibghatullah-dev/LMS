import { getInstitutionReportSummary } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/reports/institution/summary. */
export const GET = defineRoute(
  { roles: ['admin', 'super_admin'] },
  async ({ ctx }) => ok(await getInstitutionReportSummary(ctx!)),
);
