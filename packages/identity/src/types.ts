import type { Email, UserId } from '@saas/contracts';

/**
 * INVARIANT: Bearer credential pair presented at the authentication boundary.
 *
 * Constructed only at HTTP / queue input edges after primitive validation
 * (per TS3); domain code that accepts this trusts the brand on `email`.
 * The `password` field is plaintext only in-transit between the boundary
 * and {@link authenticate} — never persisted, never logged (TENANT.md T-7).
 */
export interface Credentials {
  readonly email: Email;
  readonly password: string;
}

/**
 * INVARIANT: Server-issued authenticated session.
 *
 * `token` is opaque to consumers — only {@link validateSession} resolves it
 * back to a {@link UserContext}. `expiresAt` is an ISO-8601 timestamp; the
 * concrete TTL is a Phase 1A operational tunable (block-011+), not a
 * contract.
 */
export interface Session {
  readonly token: string;
  readonly userId: UserId;
  readonly expiresAt: string;
}

/**
 * INVARIANT: Resolved actor identity for an authenticated request.
 *
 * Distinct from `TenantContext` in `@saas/contracts/tenancy` — this carries
 * only "who" (identity), not "who-in-which-tenant" (T-1). The tenancy
 * package composes `UserContext` + tenant membership into `TenantContext`.
 */
export interface UserContext {
  readonly userId: UserId;
  readonly email: Email;
}

/**
 * Discriminated error codes emitted by the identity domain. The set is
 * additive across phases — consumers switch on known codes and treat
 * unknown values as a generic auth failure.
 */
export type AuthErrorCode =
  | 'NOT_IMPLEMENTED'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'SESSION_NOT_FOUND';

/**
 * INVARIANT: All thrown errors crossing the identity public surface are
 * instances of `AuthError`.
 *
 * Per protocols/TYPESCRIPT.md §TS4, this package uses Style B (thrown
 * errors) internally; cross-package contracts in `@saas/contracts` still
 * use `Result<T, E>` when published. The `code` field is the stable
 * discriminator; `message` is human-readable detail and may change.
 */
export class AuthError extends Error {
  public readonly code: AuthErrorCode;

  public constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}
