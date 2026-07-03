import { refreshSession, verifyRefreshToken, UnauthenticatedError } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok, toErrorResponse } from '@/server/respond';
import { getRefreshCookie, setRefreshCookie } from '@/server/cookies';

/** POST /api/v1/auth/refresh — rotate tokens using the httpOnly refresh cookie. */
export const POST = defineRoute({}, async ({ req }) => {
  const token = getRefreshCookie(req);
  if (!token) return toErrorResponse(UnauthenticatedError('No refresh token.'));

  const claims = await verifyRefreshToken(token);
  const { accessToken, refreshToken } = await refreshSession(claims.userId, claims.tokenVersion);

  const res = ok({ accessToken });
  setRefreshCookie(res, refreshToken);
  return res;
});
