import { createCourse, createCourseSchema, listCourses, listCoursesSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses — catalog (published), or ?scope=mine|templates for authors. */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'], query: listCoursesSchema },
  async ({ ctx, query }) => ok(await listCourses(ctx!, query)),
);

/** POST /api/v1/courses — create a draft course (FR-COURSE-01). */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: createCourseSchema },
  async ({ ctx, body }) => ok(await createCourse(ctx!, body), 201),
);
