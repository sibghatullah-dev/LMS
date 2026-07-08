import { eventRegisterSchema, registerForEvent } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/events/{eventId}/register — register for an event/webinar. */
export const POST = defineRoute(
  { roles: ['student', 'alumnus'], body: eventRegisterSchema },
  async ({ ctx, params }) => ok(await registerForEvent(ctx!, params.eventId!), 201),
);
