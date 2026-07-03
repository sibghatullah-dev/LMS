import { submitForReview } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/courses/{courseId}/submit-for-review (FR-COURSE-07). */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await submitForReview(ctx!, params.courseId!)),
);
