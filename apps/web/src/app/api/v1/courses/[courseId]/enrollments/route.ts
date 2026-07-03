import {
  bulkEnroll,
  enrollSelf,
  enrollSchema,
  listRoster,
  rosterQuerySchema,
} from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/courses/{courseId}/enrollments — roster (instructor-owner/admin). */
export const GET = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], query: rosterQuerySchema },
  async ({ ctx, params, query }) => ok(await listRoster(ctx!, params.courseId!, query)),
);

/**
 * POST /api/v1/courses/{courseId}/enrollments.
 * Body with studentIds/studentEmails → staff bulk enroll (FR-ENROLL-03);
 * empty body → the caller self-enrolls (FR-ENROLL-01/02).
 */
export const POST = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'], body: enrollSchema },
  async ({ ctx, params, body }) => {
    const isBulk = (body.studentIds?.length ?? 0) > 0 || (body.studentEmails?.length ?? 0) > 0;
    if (isBulk) {
      return ok(await bulkEnroll(ctx!, params.courseId!, body));
    }
    return ok(await enrollSelf(ctx!, params.courseId!), 201);
  },
);
