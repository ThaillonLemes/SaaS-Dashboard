---
id: block-015-identity-password-reset
tier: M
kind: implementation
phase: Phase 1A — Identity
scope: phase-bound
status: Pending
domain: packages/identity
risk: medium
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-011-identity-password-auth
  - block-012-identity-login-endpoint
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/API.md
    - packages/identity/src/index.ts
    - packages/identity/src/password.ts
    - infrastructure/db/migrations/0002_identity_users.sql
  modify:
    - packages/identity/src/index.ts
  create:
    - infrastructure/db/migrations/0004_identity_reset_tokens.sql
    - packages/identity/src/reset.ts
    - apps/api/src/routes/reset.ts
    - packages/identity/__tests__/reset.test.ts
benchmarks: []
flags: []
metrics:
  - password_reset_requested_total
  - password_reset_completed_total
contracts_consumed:
  - packages/contracts/src/identity/index.ts
---

# Block 015 — Password reset flow

## 1. Purpose

Allow users to reset their password via a time-limited token sent to their
email address. Implements the token lifecycle; email delivery is stubbed
(logged only — real email in Phase 3).

## 2. Dependencies

- Block 011 — `hashPassword`, `verifyPassword`, users table.
- Block 012 — Fastify app to register reset routes.

## 3. Scope

### Migration `0004_identity_reset_tokens.sql`

```sql
CREATE TABLE password_reset_tokens (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    TEXT NOT NULL,
  tenant_id  TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);
CREATE INDEX reset_tokens_user_idx ON password_reset_tokens (user_id, tenant_id);
```

### `packages/identity/src/reset.ts`

- `requestPasswordReset(email, tenantId, db): Promise<void>` — creates token, logs it (no real email yet). Always succeeds (no user enumeration).
- `completePasswordReset(token, newPassword, tenantId, db): Promise<void>` — validates token, hashes new password, marks token used.

### `apps/api/src/routes/reset.ts`

- `POST /auth/reset-request` — calls `requestPasswordReset`.
- `POST /auth/reset-complete` — calls `completePasswordReset`.

### `packages/identity/__tests__/reset.test.ts`

- `requestPasswordReset` for unknown email still returns void (no enumeration).
- `completePasswordReset` with valid token updates password.
- `completePasswordReset` with expired/used token throws `IdentityError`.

## 4. Validation

- `pnpm --filter @saas/identity typecheck` passes.
- `pnpm --filter @saas/identity lint` passes.
- `pnpm --filter @saas/identity test` passes.
- `pnpm --filter @saas/api typecheck` passes.

## 5. Tenant safety

- [x] All queries scoped by `tenant_id`.
- [x] Reset request never reveals if email exists.

## 6. Out of scope

- Actual email delivery (Phase 3 notifications).
- MFA reset (Block 016).
