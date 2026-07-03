import { cloneCourse, cloneCourseSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/courses/{courseId}/clone-as-template — clone/save-as-template (FR-COURSE-05). */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: cloneCourseSchema },
  async ({ ctx, body, params }) => ok(await cloneCourse(ctx!, params.courseId!, body), 201),
);
