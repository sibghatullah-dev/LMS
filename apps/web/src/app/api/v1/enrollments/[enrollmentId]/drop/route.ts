import { dropEnrollment, dropEnrollmentSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/enrollments/{enrollmentId}/drop — self-withdraw or staff withdrawal (FR-ENROLL-05). */
export const POST = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'], body: dropEnrollmentSchema },
  async ({ ctx, params, body }) => ok(await dropEnrollment(ctx!, params.enrollmentId!, body)),
);
