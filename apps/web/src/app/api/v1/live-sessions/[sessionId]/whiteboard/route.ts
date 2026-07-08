import {
  addLiveWhiteboardEvent,
  listLiveWhiteboardEvents,
  liveWhiteboardEventCreateSchema,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/live-sessions/{sessionId}/whiteboard — list persisted whiteboard events. */
export const GET = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await listLiveWhiteboardEvents(ctx!, params.sessionId!)),
);

/** POST /api/v1/live-sessions/{sessionId}/whiteboard — add a stroke or clear event. */
export const POST = defineRoute(
  {
    roles: ['instructor', 'admin', 'super_admin'],
    body: liveWhiteboardEventCreateSchema,
  },
  async ({ ctx, params, body }) => ok(await addLiveWhiteboardEvent(ctx!, params.sessionId!, body), 201),
);
