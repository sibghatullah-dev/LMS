import { approveEnrollment } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/enrollments/{enrollmentId}/approve (FR-ENROLL-02). */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'] },
  async ({ ctx, params }) => ok(await approveEnrollment(ctx!, params.enrollmentId!)),
);
