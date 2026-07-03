import { rejectCourse, rejectCourseSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/admin/courses/{courseId}/reject (FR-COURSE-08, FR-ADMIN-02). */
export const POST = defineRoute(
  { roles: ['admin', 'super_admin'], body: rejectCourseSchema },
  async ({ ctx, body, params }) => ok(await rejectCourse(ctx!, params.courseId!, body.comment)),
);
