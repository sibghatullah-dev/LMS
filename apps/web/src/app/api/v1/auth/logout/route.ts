import { logout, verifyRefreshToken } from '@lumora/domain';
import { defineRoute } from '@/server/route';
import { ok } from '@/server/respond';
import { clearRefreshCookie, getRefreshCookie } from '@/server/cookies';

/** POST /api/v1/auth/logout — revoke refresh tokens and clear the cookie. */
export const POST = defineRoute({}, async ({ req }) => {
  const token = getRefreshCookie(req);
  if (token) {
    try {
      const claims = await verifyRefreshToken(token);
      await logout(claims.userId);
    } catch {
      // Already invalid — clearing the cookie is enough.
    }
  }
  const res = ok({ success: true });
  clearRefreshCookie(res);
  return res;
});
