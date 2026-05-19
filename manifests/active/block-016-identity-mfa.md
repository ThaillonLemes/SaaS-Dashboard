---
id: block-016-identity-mfa
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
  - block-013-identity-session-middleware
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - packages/identity/src/index.ts
    - infrastructure/db/migrations/0002_identity_users.sql
  modify:
    - packages/identity/src/index.ts
    - infrastructure/db/migrations/0002_identity_users.sql
  create:
    - packages/identity/src/mfa.ts
    - apps/api/src/routes/mfa.ts
    - packages/identity/__tests__/mfa.test.ts
benchmarks: []
flags: []
metrics:
  - mfa_enabled_total
  - mfa_verified_total
  - mfa_failed_total
contracts_consumed:
  - packages/contracts/src/identity/index.ts
---

# Block 016 — MFA / TOTP

## 1. Purpose

Add TOTP-based MFA (Google Authenticator compatible) to the identity package.
Enroll, verify, and enforce MFA on login when enabled for a user.

## 2. Dependencies

- Block 011 — users table, session tokens.
- Block 013 — session middleware for protected MFA management routes.

## 3. Scope

### Schema addition

Add `totp_secret TEXT`, `mfa_enabled BOOLEAN DEFAULT false` to users table
via a new migration `0005_identity_mfa.sql`.

### `packages/identity/src/mfa.ts`

- `generateTotpSecret(): { secret: string; otpauthUrl: string }`.
- `verifyTotp(secret, code): boolean`.
- `enrollMfa(userId, tenantId, secret, db): Promise<void>`.
- `disableMfa(userId, tenantId, db): Promise<void>`.

### `apps/api/src/routes/mfa.ts`

- `POST /auth/mfa/enroll` (protected) — generates secret, returns QR data.
- `POST /auth/mfa/confirm` (protected) — verifies code, sets `mfa_enabled = true`.
- `POST /auth/mfa/disable` (protected) — requires current TOTP code.

### MFA enforcement in login

Update `loginUser` in Block 011: if `mfa_enabled`, return a short-lived
`mfa_pending` token instead of full session. New route `POST /auth/mfa/verify`
exchanges `mfa_pending` + TOTP code for a full session token.

### `packages/identity/__tests__/mfa.test.ts`

- `generateTotpSecret` returns valid otpauth URL.
- `verifyTotp` returns true for correct code, false for wrong.
- Login with MFA enabled returns `mfa_pending` token, not session token.

## 4. Validation

- `pnpm --filter @saas/identity typecheck` passes.
- `pnpm --filter @saas/identity lint` passes.
- `pnpm --filter @saas/identity test` passes.

## 5. Tenant safety

- [x] All MFA operations scoped by `(userId, tenantId)`.

## 6. Out of scope

- SMS / email OTP (Phase 3).
- Backup codes.
- Hardware keys.
