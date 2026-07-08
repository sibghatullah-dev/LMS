import { markNativeRecordingFailed, nativeRecordingFailedSchema } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** POST /api/v1/live-sessions/{sessionId}/recording/failed — mark native recording failed. */
export const POST = defineRoute(
  { roles: ['instructor', 'admin', 'super_admin'], body: nativeRecordingFailedSchema },
  async ({ ctx, params, body }) => ok(await markNativeRecordingFailed(ctx!, params.sessionId!, body)),
);
