import { listCourseMembers } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses/{courseId}/members — shared-course participants. */
export const GET = defineRoute(
  { roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await listCourseMembers(ctx!, params.courseId!)),
);
