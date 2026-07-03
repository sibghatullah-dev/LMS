import type { NextRequest, NextResponse } from 'next/server';
import { loadEnv } from '@lumora/config';

/**
 * Refresh token cookie (SAD §8): httpOnly, secure (in prod), SameSite=Lax,
 * scoped to the refresh endpoint path so it is not sent on every request.
 */
export const REFRESH_COOKIE = 'lumora_refresh';

export function setRefreshCookie(res: NextResponse, token: string): void {
  const { REFRESH_TOKEN_TTL_DAYS, NODE_ENV } = loadEnv();
  res.cookies.set(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });
}

export function clearRefreshCookie(res: NextResponse): void {
  res.cookies.set(REFRESH_COOKIE, '', { path: '/api/v1/auth', maxAge: 0 });
}

export function getRefreshCookie(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE)?.value ?? null;
}
