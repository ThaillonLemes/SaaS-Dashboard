export type {
  AuthErrorCode,
  Credentials,
  Session,
  UserContext,
} from './types';
export { AuthError } from './types';

export { hashPassword, verifyPassword } from './password';
export { issueSessionToken, parseSessionToken } from './session';
export { loginUser, type IdentityDb } from './auth';

import { AuthError } from './types';
import type { Credentials, Session, UserContext } from './types';

/**
 * Authenticate a user by credentials and issue a {@link Session}.
 *
 * Block 005 skeleton — superseded by {@link loginUser}, which carries
 * the tenant scope and returns a `SessionToken`. Kept as a stub for
 * back-compat with the frozen Phase 0 signature until a follow-up block
 * folds the call sites over.
 */
export function authenticate(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO(block-014): fold into loginUser.
  creds: Credentials,
): Promise<Session> {
  return Promise.reject(
    new AuthError('NOT_IMPLEMENTED', 'authenticate() — use loginUser instead'),
  );
}

/**
 * Resolve a session token to its {@link UserContext}.
 *
 * Phase 0 skeleton — real implementation lands in Block 013 (session
 * middleware). Until then, use {@link parseSessionToken} for raw claim
 * extraction.
 */
export function validateSession(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO(block-013): consume token.
  token: string,
): Promise<UserContext> {
  return Promise.reject(
    new AuthError(
      'NOT_IMPLEMENTED',
      'validateSession() — Phase 1A block-013',
    ),
  );
}

/**
 * Revoke an issued session by ID.
 *
 * Phase 0 skeleton — Block 011 issues opaque JWTs without server-side
 * revocation state; a revocation list (or short-TTL + refresh) is a
 * follow-up block.
 */
export function revokeSession(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO(block-014): wire revocation list.
  sessionId: string,
): Promise<void> {
  return Promise.reject(
    new AuthError(
      'NOT_IMPLEMENTED',
      'revokeSession() — Phase 1A block-014',
    ),
  );
}
