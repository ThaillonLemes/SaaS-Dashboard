import bcrypt from 'bcryptjs';

// SECURITY: 12 rounds — OWASP ASVS L2 minimum for bcrypt as of 2026.
// Higher rounds slow login linearly without proportional attacker cost
// once GPU rigs price-in. Revisit when ASVS guidance changes.
const BCRYPT_ROUNDS = 12;

/**
 * Hash a plaintext password with bcrypt at {@link BCRYPT_ROUNDS}.
 *
 * SECURITY: The plaintext value MUST NOT be logged, traced, or emitted
 * to telemetry by any caller (protocols/TENANT.md §T-7). The returned
 * hash is safe to persist but should also not appear in logs.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/**
 * Verify a plaintext password against a previously stored bcrypt hash.
 *
 * Returns `false` on mismatch; does NOT throw. Callers translate the
 * boolean into an `IdentityError('INVALID_CREDENTIALS')` only at the
 * authentication boundary (see {@link loginUser}) — never differentiate
 * "wrong password" from "unknown user" in the response (T3).
 */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
