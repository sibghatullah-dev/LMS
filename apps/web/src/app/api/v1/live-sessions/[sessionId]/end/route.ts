import { endLiveSession } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/live-sessions/{sessionId}/end — mark a session ended. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await endLiveSession(ctx!, params.sessionId!)),
);
