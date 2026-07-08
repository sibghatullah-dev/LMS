import { getCourseLeaderboard, leaderboardQuerySchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses/{courseId}/leaderboard — per-course points ranking (FR-DASH-03). */
export const GET = defineRoute(
  {
    roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'],
    query: leaderboardQuerySchema,
  },
  async ({ ctx, params, query }) => ok(await getCourseLeaderboard(ctx!, params.courseId!, query)),
);
