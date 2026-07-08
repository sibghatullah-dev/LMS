import { markNativeRecordingAvailable, nativeRecordingCompleteSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/live-sessions/{sessionId}/recording/complete — mark native recording available. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: nativeRecordingCompleteSchema },
  async ({ ctx, params, body }) =>
    ok(await markNativeRecordingAvailable(ctx!, params.sessionId!, body)),
);
