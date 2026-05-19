export type { Email, UserId } from './types';

/**
 * INVARIANT: Opaque server-issued session credential.
 *
 * Constructed only by the identity package's `issueSessionToken` and
 * verified only by `parseSessionToken`. Treat as opaque outside identity
 * code — the encoding (currently JWT/HS256) is not part of the contract
 * and may change without breaking consumers.
 */
export type SessionToken = string & { readonly __brand: 'SessionToken' };

/**
 * Discriminated error codes emitted by the identity domain across the
 * authenticated boundary. Additive across phases — consumers switch on
 * known codes and treat unknown values as a generic auth failure.
 */
export type IdentityErrorCode = 'INVALID_CREDENTIALS';

/**
 * INVARIANT: All thrown errors crossing the identity public surface for
 * credential-bearing operations (login, token issue/parse) are instances
 * of `IdentityError`.
 *
 * The `code` field is the stable discriminator; `message` is
 * human-readable detail and may change. `INVALID_CREDENTIALS` is
 * intentionally undifferentiated — callers must not distinguish
 * "unknown email" from "wrong password" (T3 — no user enumeration).
 */
export class IdentityError extends Error {
  public readonly code: IdentityErrorCode;

  public constructor(code: IdentityErrorCode, message: string) {
    super(message);
    this.name = 'IdentityError';
    this.code = code;
  }
}
