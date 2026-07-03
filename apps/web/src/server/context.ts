import type { NextRequest } from 'next/server';
import { verifyAccessToken, type AuthContext } from '@lumora/domain';

/** Best-effort client IP for rate limiting and audit logging. */
export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Extract the auth context from the `Authorization: Bearer <accessToken>` header.
 * Returns null when absent/invalid; RBAC enforcement happens in the route wrapper
 * (a null context + a required role => 401/403).
 */
export async function getAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const header = req.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return null;
  try {
    const claims = await verifyAccessToken(header.slice(7));
    return { userId: claims.userId, institutionId: claims.institutionId, role: claims.role };
  } catch {
    return null;
  }
}
