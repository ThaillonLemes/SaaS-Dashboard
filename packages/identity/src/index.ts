export type {
  AuthErrorCode,
  Credentials,
  Session,
  UserContext,
} from './types';
export { AuthError } from './types';

import { AuthError } from './types';
import type { Credentials, Session, UserContext } from './types';

/**
 * Authenticate a user by credentials and issue a {@link Session}.
 *
 * Phase 0 skeleton — returns a rejected promise carrying
 * `AuthError('NOT_IMPLEMENTED')`. The real implementation lands in Phase
 * 1A block-011 with no public-signature change (additive fields only;
 * see manifest §9).
 */
export function authenticate(_creds: Credentials): Promise<Session> {
  return Promise.reject(
    new AuthError('NOT_IMPLEMENTED', 'authenticate() — Phase 1A block-011'),
  );
}

/**
 * Resolve a session token to its {@link UserContext}.
 *
 * Phase 0 skeleton — rejects with `AuthError('NOT_IMPLEMENTED')`. Real
 * implementation in Phase 1A block-013.
 */
export function validateSession(_token: string): Promise<UserContext> {
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
 * Phase 0 skeleton — rejects with `AuthError('NOT_IMPLEMENTED')`. Real
 * implementation in Phase 1A block-011.
 */
export function revokeSession(_sessionId: string): Promise<void> {
  return Promise.reject(
    new AuthError(
      'NOT_IMPLEMENTED',
      'revokeSession() — Phase 1A block-011',
    ),
  );
}
