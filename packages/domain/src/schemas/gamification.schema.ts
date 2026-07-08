import { z } from 'zod';

export const leaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type LeaderboardQueryInput = z.infer<typeof leaderboardQuerySchema>;

export const gamificationPreferencesSchema = z.object({
  leaderboardOptOut: z.boolean(),
});
export type GamificationPreferencesInput = z.infer<typeof gamificationPreferencesSchema>;
