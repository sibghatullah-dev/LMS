import { gamificationPreferencesSchema, updateGamificationPreferences } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';

/** PATCH /api/v1/me/gamification/preferences — leaderboard opt-out (FR-DASH-03). */
export const PATCH = defineRoute(
  {
    roles: ['student', 'alumnus', 'instructor', 'admin', 'super_admin'],
    body: gamificationPreferencesSchema,
  },
  async ({ ctx, body }) => ok(await updateGamificationPreferences(ctx!, body)),
);
