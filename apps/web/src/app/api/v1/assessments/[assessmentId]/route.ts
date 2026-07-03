import {
  getAssessment,
  updateAssessment,
  updateAssessmentSchema,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

const AUTHED = ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] as const;

/** GET /api/v1/assessments/{assessmentId}. */
export const GET = defineRoute({ roles: AUTHED }, async ({ ctx, params }) =>
  ok(await getAssessment(ctx!, params.assessmentId!)),
);

/** PATCH /api/v1/assessments/{assessmentId}; clones revision if submissions exist. */
export const PATCH = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: updateAssessmentSchema },
  async ({ ctx, params, body }) => ok(await updateAssessment(ctx!, params.assessmentId!, body)),
);
