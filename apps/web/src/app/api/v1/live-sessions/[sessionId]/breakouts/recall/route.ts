import { recallLiveBreakoutRooms } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/live-sessions/{sessionId}/breakouts/recall — recall participants to main room. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await recallLiveBreakoutRooms(ctx!, params.sessionId!)),
);
