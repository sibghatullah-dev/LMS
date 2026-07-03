import { getMyCourseGrades } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/me/courses/{courseId}/grades (FR-ASSESS-10). */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx, params }) => ok(await getMyCourseGrades(ctx!, params.courseId!)),
);
