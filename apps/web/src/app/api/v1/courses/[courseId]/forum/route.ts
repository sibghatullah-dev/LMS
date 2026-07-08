import {
  createForumThread,
  forumThreadCreateSchema,
  forumThreadListSchema,
  listForumThreads,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses/{courseId}/forum — course discussion list. */
export const GET = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'], query: forumThreadListSchema },
  async ({ ctx, params, query }) => ok(await listForumThreads(ctx!, params.courseId!, query)),
);

/** POST /api/v1/courses/{courseId}/forum — create a new thread. */
export const POST = defineRoute(
  {
    roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'],
    body: forumThreadCreateSchema,
  },
  async ({ ctx, params, body }) => ok(await createForumThread(ctx!, params.courseId!, body), 201),
);
