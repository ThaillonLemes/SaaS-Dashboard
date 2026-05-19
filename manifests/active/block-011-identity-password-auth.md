---
id: block-011-identity-password-auth
tier: M
kind: implementation
phase: Phase 1A — Identity
scope: phase-bound
status: Pending
domain: packages/identity
risk: high
performance_critical: false
created_at: 2026-05-16
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
  - block-002-postgres-baseline
  - block-004-contracts-skeleton
  - block-005-identity-skeleton
parallel_with:
  - block-018-tenancy-tenant-table
  - block-025-integrations-connector-interface
  - block-031-normalization-canonical-model
  - block-037-ui-kit-design-tokens
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/DATABASE.md
    - protocols/API.md
    - packages/contracts/src/identity/index.ts
    - packages/identity/src/index.ts
    - infrastructure/db/drizzle.config.ts
    - infrastructure/db/migrations/0001_init.sql
    - decisions/ADR-0002-postgres-orm.md
  modify:
    - packages/identity/src/index.ts
    - packages/contracts/src/identity/index.ts
  create:
    - infrastructure/db/migrations/0002_identity_users.sql
    - packages/identity/src/auth.ts
    - packages/identity/src/session.ts
    - packages/identity/src/password.ts
    - packages/identity/__tests__/auth.test.ts
    - packages/identity/__tests__/session.test.ts
benchmarks: []
flags: []
metrics:
  - auth_login_total
  - auth_login_duration_seconds
  - session_active_total
contracts_consumed:
  - packages/contracts/src/identity/index.ts
---

# Block 011 — Password auth + session token issue

## 1. Purpose

Implement password hashing, credential verification, and session token
generation in `packages/identity`. This is the auth core; the API
endpoint (Block 012) and middleware (Block 013) consume it.

## 2. Dependencies

- Block 001 — workspace tooling.
- Block 002 — Postgres + Drizzle (users table lives here).
- Block 004 — contracts (UserId, TenantId, SessionToken types).
- Block 005 — identity skeleton (public surface to fill in).

## 3. Scope

### Users table migration (`0002_identity_users.sql`)

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id   TEXT NOT NULL,
  email       TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX users_tenant_idx ON users (tenant_id);
```

### `packages/identity/src/password.ts`

- `hashPassword(plain: string): Promise<string>` — bcrypt, 12 rounds.
- `verifyPassword(plain: string, hash: string): Promise<boolean>`.
- Never log passwords or hashes.

### `packages/identity/src/session.ts`

- `issueSessionToken(userId: UserId, tenantId: TenantId): SessionToken` — signed JWT (HS256), 24h TTL, `sub=userId`, `tid=tenantId`.
- `parseSessionToken(token: SessionToken): { userId: UserId; tenantId: TenantId } | null` — returns null on expired/invalid.
- JWT secret from `process.env['SESSION_SECRET']` — throw at startup if missing.

### `packages/identity/src/auth.ts`

- `loginUser(email: string, password: string, tenantId: TenantId, db: DrizzleDb): Promise<SessionToken>`.
- Looks up user by `(tenant_id, email)`. If not found or password mismatch → throws `IdentityError` with code `INVALID_CREDENTIALS`. Never distinguish "not found" from "wrong password" in the error.

### Contracts update

Add `SessionToken` branded type and `IdentityError` class to `packages/contracts/src/identity/index.ts`.

## 4. Validation

- `pnpm --filter @saas/identity typecheck` passes.
- `pnpm --filter @saas/identity lint` passes.
- `pnpm --filter @saas/identity test` passes:
  - `hashPassword` + `verifyPassword` round-trip.
  - `loginUser` returns a token on correct credentials (in-memory DB stub or test Postgres).
  - `loginUser` throws `INVALID_CREDENTIALS` on wrong password.
  - `loginUser` throws `INVALID_CREDENTIALS` on unknown email (same error — no enumeration).
  - `parseSessionToken` returns null on expired token.
- Migration `0002_identity_users.sql` runs idempotently on a fresh DB.

## 5. Tenant safety check

- [x] All user lookups are scoped by `tenant_id` — no cross-tenant user enumeration possible.
- [x] Error messages do not distinguish "user not found" from "wrong password" (T3).
- [x] JWT `tid` claim binds session to tenant — middleware (Block 013) enforces this.

## 6. Out of scope

- Login API endpoint (Block 012).
- Session validation middleware (Block 013).
- Password reset (Block 015).
- MFA (Block 016).
- OAuth / SSO.
