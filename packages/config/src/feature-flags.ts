/**
 * Feature flags (DDD §3.1 institutions.featureFlags, plan D2).
 *
 * Two layers:
 *  1. Per-institution flags stored on the `institutions` document (source of truth).
 *  2. These platform-level DEFAULTS, used when seeding an institution and as the
 *     fallback for platform-wide gating (e.g. native live classroom is deferred to
 *     Phase 15 and ships disabled by default).
 */
export interface InstitutionFeatureFlags {
  /** Native mediasoup WebRTC classroom — Phase 15, off by default (plan D2). */
  nativeLiveClassroom: boolean;
  /** Zoom integration — Phase 10. */
  zoomIntegration: boolean;
  /** MS Teams integration — Phase 10. */
  teamsIntegration: boolean;
  /** Alumni portal — Phase 14. */
  alumniPortal: boolean;
  /** Gamification (badges/points/leaderboard) — Phase 11. */
  gamification: boolean;
}

export const DEFAULT_FEATURE_FLAGS: InstitutionFeatureFlags = {
  nativeLiveClassroom: false,
  zoomIntegration: false,
  teamsIntegration: false,
  alumniPortal: true,
  gamification: true,
};
