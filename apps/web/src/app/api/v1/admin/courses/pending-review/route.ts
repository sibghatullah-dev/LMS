import { listPendingReview } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/admin/courses/pending-review (UC-03). */
export const GET = defineRoute({ roles: ['admin', 'super_admin'] }, async ({ ctx }) =>
  ok(await listPendingReview(ctx!)),
);
