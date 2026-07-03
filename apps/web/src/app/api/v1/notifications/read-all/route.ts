import { markAllNotificationsRead } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/notifications/read-all. */
export const POST = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx }) => ok(await markAllNotificationsRead(ctx!)),
);
