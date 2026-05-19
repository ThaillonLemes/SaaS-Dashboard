import type { SessionToken, TenantId, UserId } from '@saas/contracts';
import jwt from 'jsonwebtoken';

// SECURITY: HS256 with a single rotated secret matches our deployment
// model (single API tier, shared secret loaded from env at boot). When
// we add a second issuer (e.g. SSO callback service) the move to
// asymmetric (RS256) belongs in its own block.
const ALGORITHM: jwt.Algorithm = 'HS256';

// 24h TTL per block-011 manifest; matches the "remember-me-by-default"
// product stance documented in features.md. Re-issue on each successful
// auth — no sliding refresh in this block.
const TOKEN_TTL_SECONDS = 60 * 60 * 24;

interface SessionClaims {
  readonly sub: UserId;
  readonly tid: TenantId;
}

function getSecret(): string {
  const secret = process.env['SESSION_SECRET'];
  if (secret === undefined || secret.length === 0) {
    // WHY: identity is a foundation package; a missing secret at boot is
    // a deployment bug, not a per-request error. Fail loudly so the
    // process never serves traffic with an unsigned token.
    throw new Error(
      'SESSION_SECRET environment variable is required for identity package',
    );
  }
  return secret;
}

/**
 * Issue a signed session token for `(userId, tenantId)`.
 *
 * The encoding is JWT/HS256 with a 24h TTL; the resulting string is
 * opaque to consumers (typed as the branded {@link SessionToken}).
 * Throws if `SESSION_SECRET` is not configured in the environment.
 */
export function issueSessionToken(
  userId: UserId,
  tenantId: TenantId,
): SessionToken {
  const claims: SessionClaims = { sub: userId, tid: tenantId };
  const token = jwt.sign(claims, getSecret(), {
    algorithm: ALGORITHM,
    expiresIn: TOKEN_TTL_SECONDS,
  });
  return token as SessionToken;
}

/**
 * Parse and verify a session token.
 *
 * Returns the embedded `(userId, tenantId)` on success, or `null` if the
 * token is malformed, signed with the wrong key, or expired. Never
 * throws on user-supplied input — the caller decides how to respond to
 * `null` (typically a 401 at the HTTP boundary, Block 013).
 */
export function parseSessionToken(
  token: SessionToken,
): { userId: UserId; tenantId: TenantId } | null {
  let payload: unknown;
  try {
    payload = jwt.verify(token, getSecret(), { algorithms: [ALGORITHM] });
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) return null;
  const claims = payload as Record<string, unknown>;
  const sub = claims['sub'];
  const tid = claims['tid'];
  if (typeof sub !== 'string' || typeof tid !== 'string') return null;
  return { userId: sub as UserId, tenantId: tid as TenantId };
}
