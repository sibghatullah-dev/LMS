import { ingestProviderLiveSessionReport, providerAttendanceReportSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/live-sessions/{sessionId}/provider-report — ingest Zoom/Teams recording + attendance. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: providerAttendanceReportSchema },
  async ({ ctx, params, body }) =>
    ok(await ingestProviderLiveSessionReport(ctx!, params.sessionId!, body)),
);
