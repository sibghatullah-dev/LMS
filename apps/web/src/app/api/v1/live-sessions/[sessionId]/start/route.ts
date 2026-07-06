import { startLiveSession } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/live-sessions/{sessionId}/start — mark a session live. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await startLiveSession(ctx!, params.sessionId!)),
);
