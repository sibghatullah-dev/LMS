import { markNotificationRead } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/notifications/{notificationId}/read. */
export const POST = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx, params }) => ok(await markNotificationRead(ctx!, params.notificationId!)),
);
