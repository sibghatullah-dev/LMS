import { forumAcceptAnswerSchema, acceptForumAnswer } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** PATCH /api/v1/courses/{courseId}/forum/{threadId}/accepted-answer. */
export const PATCH = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: forumAcceptAnswerSchema },
  async ({ ctx, params, body }) => ok(await acceptForumAnswer(ctx!, params.courseId!, params.threadId!, body)),
);
