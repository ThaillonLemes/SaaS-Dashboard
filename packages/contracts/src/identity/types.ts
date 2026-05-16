/**
 * INVARIANT: Branded primary key for `packages/identity`.
 *
 * Construct via the identity-package validator at every input boundary
 * (HTTP, queue, external API). Never coerce from a raw `string` inside
 * domain code — the brand guarantees the value was validated.
 */
export type UserId = string & { readonly __brand: 'UserId' };

/**
 * INVARIANT: Branded RFC-5322-style email address.
 *
 * Construct via the identity-package validator at every input boundary.
 * A function accepting `Email` is guaranteed by the type system that the
 * value is well-formed; defensive re-validation inside the system is
 * forbidden (Q2).
 */
export type Email = string & { readonly __brand: 'Email' };
