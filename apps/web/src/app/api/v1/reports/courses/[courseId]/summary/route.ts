import { getCourseReportSummary } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/reports/courses/{courseId}/summary. */
export const GET = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await getCourseReportSummary(ctx!, params.courseId!)),
);
