import { getLessonContent } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses/{courseId}/lessons/{lessonId} — content with signed URLs. */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx, params }) => ok(await getLessonContent(ctx!, params.courseId!, params.lessonId!)),
);
