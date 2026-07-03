import { listNotifications, listNotificationsSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/notifications (FR-NOTIFY-01). */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'], query: listNotificationsSchema },
  async ({ ctx, query }) => ok(await listNotifications(ctx!, query)),
);
