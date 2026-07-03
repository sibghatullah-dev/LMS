import { gradeSubmission, gradeSubmissionSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** PATCH /api/v1/submissions/{submissionId}/grade (FR-ASSESS-05/06). */
export const PATCH = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: gradeSubmissionSchema },
  async ({ ctx, params, body }) => ok(await gradeSubmission(ctx!, params.submissionId!, body)),
);
