import {
  createLiveBreakoutRooms,
  listLiveBreakoutRooms,
  liveBreakoutRoomCreateSchema,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/live-sessions/{sessionId}/breakouts — list native breakout rooms. */
export const GET = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await listLiveBreakoutRooms(ctx!, params.sessionId!)),
);

/** POST /api/v1/live-sessions/{sessionId}/breakouts — create/replace breakout rooms. */
export const POST = defineRoute(
  {
    roles: ['instructor', 'admin', 'super_admin'],
    body: liveBreakoutRoomCreateSchema,
  },
  async ({ ctx, params, body }) => ok(await createLiveBreakoutRooms(ctx!, params.sessionId!, body), 201),
);
