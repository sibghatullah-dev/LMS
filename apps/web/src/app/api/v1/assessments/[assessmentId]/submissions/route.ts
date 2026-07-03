import {
  createSubmissionSchema,
  listSubmissions,
  listSubmissionsSchema,
  submitAssessment,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/assessments/{assessmentId}/submissions — instructor grading queue. */
export const GET = defineRoute(
  {
    roles: ['instructor', 'admin', 'super_admin'],
    query: listSubmissionsSchema,
  },
  async ({ ctx, params, query }) => ok(await listSubmissions(ctx!, params.assessmentId!, query)),
);

/** POST /api/v1/assessments/{assessmentId}/submissions — student submit. */
export const POST = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin'], body: createSubmissionSchema },
  async ({ ctx, params, body }) => ok(await submitAssessment(ctx!, params.assessmentId!, body), 201),
);
