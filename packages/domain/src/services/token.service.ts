import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { loadEnv, type Role } from '@lumora/config';
import { UnauthenticatedError } from '../errors';
import type { AuthContext } from '../rbac/roles';

/**
 * JWT access + refresh tokens (SAD §8, FR-AUTH-02).
 *
 * - Access token: short-lived (default 15 min), carries the auth context claims;
 *   verified on every request by the API route wrapper.
 * - Refresh token: long-lived (default 30 days), carries `tokenVersion`. On
 *   refresh we re-check it against the user's current `tokenVersion`, so logout /
 *   password reset / role change (which bump the version) invalidate all
 *   outstanding refresh tokens. Delivered as an httpOnly, secure cookie.
 */
const ALG = 'HS256';
const ISSUER = 'lumora';

function secretKey(): Uint8Array {
  return new TextEncoder().encode(loadEnv().NEXTAUTH_SECRET);
}

export interface AccessClaims extends AuthContext {
  email: string;
}

export interface RefreshClaims {
  userId: string;
  tokenVersion: number;
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  const { ACCESS_TOKEN_TTL_MIN } = loadEnv();
  return new SignJWT({
    institutionId: claims.institutionId,
    role: claims.role,
    email: claims.email,
    type: 'access',
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_MIN}m`)
    .sign(secretKey());
}

export async function signRefreshToken(claims: RefreshClaims): Promise<string> {
  const { REFRESH_TOKEN_TTL_DAYS } = loadEnv();
  return new SignJWT({ tokenVersion: claims.tokenVersion, type: 'refresh' })
    .setProtectedHeader({ alg: ALG })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL_DAYS}d`)
    .sign(secretKey());
}

async function verify(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER });
    return payload;
  } catch {
    throw UnauthenticatedError('Invalid or expired token');
  }
}

/** Verify an access token and return the auth context (throws 401 otherwise). */
export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const payload = await verify(token);
  if (payload.type !== 'access' || !payload.sub) {
    throw UnauthenticatedError('Invalid access token');
  }
  return {
    userId: payload.sub,
    institutionId: String(payload.institutionId),
    role: payload.role as Role,
    email: String(payload.email),
  };
}

/** Verify a refresh token and return its claims (throws 401 otherwise). */
export async function verifyRefreshToken(token: string): Promise<RefreshClaims> {
  const payload = await verify(token);
  if (payload.type !== 'refresh' || !payload.sub) {
    throw UnauthenticatedError('Invalid refresh token');
  }
  return { userId: payload.sub, tokenVersion: Number(payload.tokenVersion) };
}
