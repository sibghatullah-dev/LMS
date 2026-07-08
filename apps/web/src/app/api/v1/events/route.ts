import { createEvent, eventCreateSchema, eventListQuerySchema, listEvents } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/events — browse upcoming events/webinars. */
export const GET = defineRoute(
  {
    roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'],
    query: eventListQuerySchema,
  },
  async ({ ctx, query }) => ok(await listEvents(ctx!, query)),
);

/** POST /api/v1/events — create a standalone event/webinar. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: eventCreateSchema },
  async ({ ctx, body }) => ok(await createEvent(ctx!, body), 201),
);
