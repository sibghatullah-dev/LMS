import { approveCourse } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/admin/courses/{courseId}/approve (FR-COURSE-07, FR-ADMIN-02). */
export const POST = defineRoute({ roles: ['admin', 'super_admin'] }, async ({ ctx, params }) =>
  ok(await approveCourse(ctx!, params.courseId!)),
);
