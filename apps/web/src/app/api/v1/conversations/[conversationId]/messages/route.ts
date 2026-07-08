import {
  conversationMessageCreateSchema,
  conversationListSchema,
  listConversationMessages,
  sendConversationMessage,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/conversations/{conversationId}/messages. */
export const GET = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'], query: conversationListSchema },
  async ({ ctx, params, query }) => ok(await listConversationMessages(ctx!, params.conversationId!, query)),
);

/** POST /api/v1/conversations/{conversationId}/messages. */
export const POST = defineRoute(
  {
    roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'],
    body: conversationMessageCreateSchema,
  },
  async ({ ctx, params, body }) => ok(await sendConversationMessage(ctx!, params.conversationId!, body), 201),
);
