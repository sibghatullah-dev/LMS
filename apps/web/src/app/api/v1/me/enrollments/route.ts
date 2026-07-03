import { getMyEnrollments, myEnrollmentsQuerySchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/me/enrollments (FR-ENROLL-04). */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'], query: myEnrollmentsQuerySchema },
  async ({ ctx, query }) => ok(await getMyEnrollments(ctx!, query)),
);
