import { listLiveChatMessages, liveChatMessageCreateSchema, sendLiveChatMessage } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/live-sessions/{sessionId}/chat — list native classroom chat messages. */
export const GET = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await listLiveChatMessages(ctx!, params.sessionId!)),
);

/** POST /api/v1/live-sessions/{sessionId}/chat — send native classroom chat message. */
export const POST = defineRoute(
  {
    roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'],
    body: liveChatMessageCreateSchema,
  },
  async ({ ctx, params, body }) => ok(await sendLiveChatMessage(ctx!, params.sessionId!, body), 201),
);
