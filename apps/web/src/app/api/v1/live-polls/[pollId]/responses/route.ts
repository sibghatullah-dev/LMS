import { livePollResponseSchema, respondToLivePoll } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/live-polls/{pollId}/responses — submit/update learner poll response. */
export const POST = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'], body: livePollResponseSchema },
  async ({ ctx, params, body }) => ok(await respondToLivePoll(ctx!, params.pollId!, body)),
);
