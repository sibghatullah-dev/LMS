import { getCoursePlayer } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses/{courseId}/player — module locks + progress summary (FR-CONTENT-03/04). */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx, params }) => ok(await getCoursePlayer(ctx!, params.courseId!)),
);
