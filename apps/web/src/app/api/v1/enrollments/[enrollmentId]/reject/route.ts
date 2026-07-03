import { rejectEnrollment, rejectEnrollmentSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/enrollments/{enrollmentId}/reject (FR-ENROLL-02). */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: rejectEnrollmentSchema },
  async ({ ctx, params, body }) => ok(await rejectEnrollment(ctx!, params.enrollmentId!, body)),
);
