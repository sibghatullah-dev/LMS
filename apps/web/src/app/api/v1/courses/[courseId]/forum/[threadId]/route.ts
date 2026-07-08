import { getForumThread } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses/{courseId}/forum/{threadId} — thread detail. */
export const GET = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await getForumThread(ctx!, params.courseId!, params.threadId!)),
);
