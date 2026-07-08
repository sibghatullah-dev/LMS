import { forumReplyCreateSchema, replyForumThread } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/courses/{courseId}/forum/{threadId}/replies — add a threaded reply. */
export const POST = defineRoute(
  {
    roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'],
    body: forumReplyCreateSchema,
  },
  async ({ ctx, params, body }) => ok(await replyForumThread(ctx!, params.courseId!, params.threadId!, body), 201),
);
