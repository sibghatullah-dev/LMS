import bcrypt from 'bcryptjs';

/**
 * Password hashing (NFR-SEC-02): bcrypt with per-user salt. Plaintext is never
 * logged or stored. Cost factor 12 balances security and login latency for MVP.
 */
const BCRYPT_COST = 12;

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}
