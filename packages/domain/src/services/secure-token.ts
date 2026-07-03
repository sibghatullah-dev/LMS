import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Single-use, time-limited tokens for email verification and password reset
 * (FR-AUTH-01, FR-AUTH-05). The raw token is emailed to the user; only its
 * SHA-256 hash is stored, so a database read never exposes a usable token.
 */
export function generateRawToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Constant-time comparison of a presented raw token against a stored hash. */
export function tokenMatches(raw: string, storedHash: string | null | undefined): boolean {
  if (!storedHash) return false;
  const a = Buffer.from(hashToken(raw));
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}
