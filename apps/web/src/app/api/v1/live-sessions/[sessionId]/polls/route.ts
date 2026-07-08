import { launchLivePoll, listLivePolls, livePollCreateSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/live-sessions/{sessionId}/polls — list poll results for a live session. */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx, params }) => ok(await listLivePolls(ctx!, params.sessionId!)),
);

/** POST /api/v1/live-sessions/{sessionId}/polls — launch a native live poll. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: livePollCreateSchema },
  async ({ ctx, params, body }) => ok(await launchLivePoll(ctx!, params.sessionId!, body), 201),
);
