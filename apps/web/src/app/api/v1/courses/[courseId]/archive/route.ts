import { archiveCourse } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/courses/{courseId}/archive (FR-COURSE-10). */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await archiveCourse(ctx!, params.courseId!)),
);
