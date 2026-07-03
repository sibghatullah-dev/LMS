import { bulkGradeSchema, bulkGradeSubmissions } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/assessments/{assessmentId}/submissions/bulk-grade (FR-ASSESS-07). */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: bulkGradeSchema },
  async ({ ctx, params, body }) => ok(await bulkGradeSubmissions(ctx!, params.assessmentId!, body)),
);
