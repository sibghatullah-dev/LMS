import { getSubmission } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

const AUTHED = ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] as const;

/** GET /api/v1/submissions/{submissionId}. */
export const GET = defineRoute({ roles: AUTHED }, async ({ ctx, params }) =>
  ok(await getSubmission(ctx!, params.submissionId!)),
);
