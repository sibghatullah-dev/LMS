import {
  createAssessment,
  createAssessmentSchema,
  listAssessments,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

const AUTHED = ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] as const;

/** GET /api/v1/courses/{courseId}/assessments (FR-ASSESS). */
export const GET = defineRoute({ roles: AUTHED }, async ({ ctx, params }) =>
  ok(await listAssessments(ctx!, params.courseId!)),
);

/** POST /api/v1/courses/{courseId}/assessments — instructor creates assignment/quiz. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: createAssessmentSchema },
  async ({ ctx, params, body }) => ok(await createAssessment(ctx!, params.courseId!, body), 201),
);
