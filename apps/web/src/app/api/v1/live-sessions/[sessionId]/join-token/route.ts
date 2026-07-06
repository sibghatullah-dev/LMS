import { createLiveSessionJoinToken } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** GET /api/v1/live-sessions/{sessionId}/join-token — get native join token or external join URL. */
export const GET = defineRoute(
  { roles: ['student', 'instructor', 'admin', 'super_admin', 'alumnus'] },
  async ({ ctx, params }) => ok(await createLiveSessionJoinToken(ctx!, params.sessionId!)),
);
