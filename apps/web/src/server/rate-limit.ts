import { RateLimitedError } from '@lumora/domain';

/**
 * Fixed-window rate limiter (NFR-SEC-07). Applied to auth and write-heavy
 * endpoints to mitigate brute-force/abuse.
 *
 * Phase 1 uses an in-process Map so it works without Redis locally. In cloud
 * (Phase 9) this is swapped for a Redis-backed limiter shared across instances;
 * the call sites don't change (they call `enforceRateLimit`).
 */
interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

export interface RateLimitOptions {
  /** Unique bucket key, e.g. `login:${ip}`. */
  key: string;
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export function enforceRateLimit({ key, limit, windowMs }: RateLimitOptions): void {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (existing.count >= limit) {
    throw RateLimitedError('Too many requests. Please slow down and try again shortly.');
  }
  existing.count += 1;
}
