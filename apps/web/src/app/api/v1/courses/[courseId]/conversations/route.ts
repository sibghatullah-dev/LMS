import {
  conversationCreateSchema,
  conversationListSchema,
  createConversation,
  listCourseConversations,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses/{courseId}/conversations — list shared-course conversations. */
export const GET = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'], query: conversationListSchema },
  async ({ ctx, params, query }) => ok(await listCourseConversations(ctx!, params.courseId!, query)),
);

/** POST /api/v1/courses/{courseId}/conversations — create a direct or group channel. */
export const POST = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'], body: conversationCreateSchema },
  async ({ ctx, params, body }) => ok(await createConversation(ctx!, params.courseId!, body), 201),
);
