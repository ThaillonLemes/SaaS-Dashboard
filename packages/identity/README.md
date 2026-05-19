# `packages/identity` — authentication, sessions, user-context resolution

## Identity

The bounded context that owns "who is this caller?" — credential check,
session issuance, and resolution of an opaque session token back to a
`UserContext`. The tenancy package composes this with tenant membership
to produce a `TenantContext` (T-1). This package never touches tenant
data directly; it only proves identity.

This is the **Phase 0 skeleton**. The public surface is frozen by this
block; Phase 1A block-011+ replaces stub bodies with real
implementations against the same signatures.

---

## What this owns

- The `authenticate` / `validateSession` / `revokeSession` public
  surface and their signatures.
- Domain-internal types: `Session`, `UserContext`, `Credentials`,
  `AuthError`, `AuthErrorCode`.
- (Future, Phase 1A) password hashing, session storage, token issuance,
  the `users` table.

## What this does NOT own

- `TenantContext` and tenant membership — lives in `packages/tenancy`
  (consumed via `@saas/contracts`).
- The `UserId` / `Email` brand definitions — published in
  `@saas/contracts/identity/types.ts` (this package is the validator,
  not the brand author).
- HTTP routing — lives in `apps/api`.
- Audit log writes for cross-tenant ops — lives in `packages/audit`
  (Phase 1B).

Per D1, this package never reaches into other packages' internals.

---

## Public surface (`src/index.ts`)

```ts
export function authenticate(creds: Credentials): Promise<Session>;
export function validateSession(token: string): Promise<UserContext>;
export function revokeSession(sessionId: string): Promise<void>;

export type { Credentials, Session, UserContext, AuthErrorCode };
export { AuthError };
```

Types from `@saas/contracts/identity/`:
- `UserId`
- `Email`

---

## Internal structure

```
packages/identity/
├── src/
│   ├── index.ts          ← public surface (stubs)
│   └── types.ts          ← Session, UserContext, Credentials, AuthError
├── __tests__/
│   └── skeleton.test.ts  ← stubs reject with AuthError NOT_IMPLEMENTED
├── package.json
├── tsconfig.json
├── STATE.md              ← local state (skeleton, Phase 1A next)
└── README.md             ← this file
```

Phase 1A blocks will introduce `src/internal/` (password hashing, token
generation), `src/repository.ts` (users table access), and
`src/service.ts` (orchestration). None of those exist yet.

---

## Dependencies

- `@saas/contracts` — `UserId`, `Email` brands.

No `@saas/observability` dependency yet — added when stubs gain bodies
(Phase 1A). No deep imports (D1).

---

## Database tables

None at Phase 0. Phase 1A block-011 lands the `users` table per
[protocols/DATABASE.md](../../protocols/DATABASE.md). The table is
**not tenant-scoped** (a user can belong to multiple tenants); the
join lives in `packages/tenancy`'s `tenant_memberships` table.

---

## Cross-cutting concerns

- **Tenancy:** identity is upstream of tenancy. `authenticate` /
  `validateSession` resolve identity only; tenant membership is a
  separate call into `packages/tenancy`. No `TenantContext` argument
  here — by design (T-1).
- **Observability:** future bodies will emit a span around each public
  call and a log record with `userId` (never `password`,
  never raw `email` — see PII rules in
  [protocols/TENANT.md §T-7](../../protocols/TENANT.md)).
- **Errors:** thrown errors are `AuthError` subclasses with stable
  `code` discriminator. Style B (throw) per
  [protocols/TYPESCRIPT.md §TS4](../../protocols/TYPESCRIPT.md) —
  this is app-internal; published cross-domain contracts in
  `@saas/contracts` would use `Result<T, E>` instead.

---

## Testing

```
pnpm --filter @saas/identity test
```

Phase 0 covers:

- `AuthError` carries `code`, `message`, and identifies via `instanceof`.
- Each public function rejects with `AuthError` code `NOT_IMPLEMENTED`.
- Type shapes (`Session`, `UserContext`, `Credentials`) compose with
  `@saas/contracts` brands without `any` leakage.

Phase 1A adds: real auth tests, session lifecycle tests, and the
tenant-isolation suite mandated by [TENANT.md §T-9](../../protocols/TENANT.md).

---

## Current state

See [STATE.md](./STATE.md). Block 005 (skeleton) is the current and
only landed block.

---

## How to add to this domain

1. Read this file + `../../PROTOCOLS.md` + `../../protocols/TYPESCRIPT.md`.
2. Read `../../protocols/TENANT.md` for tenant-field conventions.
3. Author a block manifest from `../../templates/manifest-M.md`.
4. Implement within manifest scope (C2).
5. Validate: typecheck, lint, test.
6. Open PR; tag for Governor review.
