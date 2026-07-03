import { getCourse, updateCourse, updateCourseSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

const AUTHED = ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] as const;

/** GET /api/v1/courses/{courseId}. */
export const GET = defineRoute({ roles: AUTHED }, async ({ ctx, params }) =>
  ok(await getCourse(ctx!, params.courseId!)),
);

/** PATCH /api/v1/courses/{courseId} — metadata + module tree (FR-COURSE-02/03). */
export const PATCH = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: updateCourseSchema },
  async ({ ctx, body, params }) => ok(await updateCourse(ctx!, params.courseId!, body)),
);
