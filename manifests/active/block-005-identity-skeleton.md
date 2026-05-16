---
id: block-005-identity-skeleton
tier: M
kind: implementation
phase: Phase 0 — Foundation
scope: phase-bound
status: Pending
domain: packages/identity
risk: low
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
  - block-004-contracts-skeleton
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/TENANT.md
    - DOMAIN_ARCHITECTURE.md
    - AGENT_OPERATING_MODEL.md
    - templates/domain-doc.md
    - packages/contracts/src/identity/types.ts
    - packages/contracts/src/tenancy/types.ts
  modify: []
  create:
    - packages/identity/package.json
    - packages/identity/tsconfig.json
    - packages/identity/README.md
    - packages/identity/STATE.md
    - packages/identity/src/index.ts
    - packages/identity/src/types.ts
    - packages/identity/__tests__/skeleton.test.ts
benchmarks: []
flags: []
metrics: []
contracts_consumed:
  - "@saas/contracts/identity/UserId"
  - "@saas/contracts/identity/Email"
contracts_published: []
---

# Block 005 — `packages/identity` skeleton

## 1. Purpose

Land the scaffolding for the identity domain. Publish the package's
**public-surface signatures** (function types only, no implementation).
Phase 1A Block 011+ fills in real auth.

## 2. Dependencies

- Block 001 (workspace).
- Block 004 (contracts must export `UserId`, `Email`).

## 3. Scope

### Public surface (`packages/identity/src/index.ts`)

```ts
export type { Session, UserContext, AuthError, Credentials } from './types';

// Function signatures — stub implementations throw "Not implemented yet"
export declare function authenticate(creds: Credentials): Promise<Session>;
export declare function validateSession(token: string): Promise<UserContext>;
export declare function revokeSession(sessionId: string): Promise<void>;
```

OR (preferred — avoids `declare` ambiguity):

```ts
import type { UserId, Email } from '@saas/contracts';

export interface Credentials { email: Email; password: string; }
export interface Session { token: string; userId: UserId; expiresAt: string; }
export interface UserContext { userId: UserId; email: Email; }
export class AuthError extends Error { constructor(public code: string, message: string) { super(message); } }

export async function authenticate(_creds: Credentials): Promise<Session> {
  throw new AuthError('NOT_IMPLEMENTED', 'authenticate() — Phase 1A block-011');
}

export async function validateSession(_token: string): Promise<UserContext> {
  throw new AuthError('NOT_IMPLEMENTED', 'validateSession() — Phase 1A block-013');
}

export async function revokeSession(_sessionId: string): Promise<void> {
  throw new AuthError('NOT_IMPLEMENTED', 'revokeSession() — Phase 1A block-011');
}
```

Stub bodies throw a documented `AuthError` with code `NOT_IMPLEMENTED`
so consumers fail loudly during Phase 0 if they try to call.

### Types (`src/types.ts`)

Domain-internal types: `Session`, `UserContext`, `Credentials`,
`AuthError`. Cross-domain types stay in `@saas/contracts`.

### README (`packages/identity/README.md`)

Per [templates/domain-doc.md](../../templates/domain-doc.md). Identity,
ownership scope, dependencies (`@saas/contracts`, `@saas/observability`).
Notes that this is a **skeleton** — Phase 1A blocks fill in.

### STATE.md (`packages/identity/STATE.md`)

Per the package-state pattern in [INDEX.md:91-104](../../INDEX.md:91).
Records "skeleton; not yet implementing auth; Phase 1A Block 011 next."

### Tests (`__tests__/skeleton.test.ts`)

- `authenticate()` throws `AuthError` with code `NOT_IMPLEMENTED`.
- `validateSession()` throws `AuthError` with code `NOT_IMPLEMENTED`.
- Types compile against `@saas/contracts` types (no `any` leak).

## 4. Validation

- `pnpm --filter @saas/identity typecheck` passes.
- `pnpm --filter @saas/identity lint` passes.
- `pnpm --filter @saas/identity test` passes (skeleton tests).
- ESLint's D1 rule allows `import { UserId } from '@saas/contracts'`
  (public surface) but would block `from '@saas/contracts/src/...'`
  (deep).
- Package imports only from `@saas/contracts` and `@saas/observability`.

## 5. Rollback signals

- Type leakage of an internal type (e.g., `Session` shape changes mid-block).
- Phase 0 consumer accidentally calls a stub and gets a non-AuthError.

## 6. Expected outcomes

After integration:
- `import { authenticate, validateSession } from '@saas/identity'` works
  type-wise across the workspace.
- Phase 1A Block 011 fills the stubs with real implementations against
  the same signatures (no signature changes — additive only).
- The Identity Agent (per [AGENT_OPERATING_MODEL.md:21](../../AGENT_OPERATING_MODEL.md:21))
  is the sole writer to this package going forward.

## 7. Tenant safety check

- [x] No tables created (Phase 1A Block 011 lands `users` table per
      [DATABASE.md:22-27](../../protocols/DATABASE.md:22)).
- [x] No repository methods.
- [x] No HTTP endpoints.
- [x] Stub functions don't operate on tenant data.

## 8. Cross-domain check

- [x] No deep imports across packages (D1).
- [x] Cross-domain types from `@saas/contracts/identity/*` (D2).
- [x] No utility duplication (C3).

## 9. Risks

- **Risk:** Phase 1A Block 011 needs to change a signature (e.g., add `MFA` to `Credentials`). **Mitigation:** Signature change is its own contract block; additive (e.g., `mfaCode?: string`) is preferred.
- **Risk:** `AuthError` class hierarchy conflicts with `Result<T, E>` style chosen later. **Mitigation:** Document the choice in `packages/identity/README.md`; per [protocols/TYPESCRIPT.md:67-93](../../protocols/TYPESCRIPT.md:67), package picks one style. Default: throws (Style B) since this is app-internal.

## 10. Out of scope

- Real password hashing (Phase 1A Block 011).
- Session token issuance (Phase 1A Block 011).
- Password reset flow (Phase 1A Block 015).
- MFA (Phase 1A Block 016, optional).
- Login UI (Phase 1A Block 014).

## 11. New abstraction

None. Stub functions, types, error class — all standard idioms.
