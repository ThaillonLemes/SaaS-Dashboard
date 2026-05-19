---
id: block-013-identity-session-middleware
tier: M
kind: implementation
phase: Phase 1A — Identity
scope: phase-bound
status: Pending
domain: apps/api
risk: high
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
    - protocols/TENANT.md
    - apps/api/src/index.ts
    - packages/identity/src/session.ts
    - packages/contracts/src/identity/index.ts
  modify:
    - apps/api/src/index.ts
  create:
    - apps/api/src/plugins/session.ts
    - apps/api/__tests__/session-middleware.test.ts
benchmarks: []
flags: []
metrics:
  - session_validated_total
  - session_invalid_total
contracts_consumed:
  - packages/contracts/src/identity/index.ts
---

# Block 013 — Session validation middleware

## 1. Purpose

Fastify plugin that validates the `Authorization: Bearer <token>` header on
every protected route, decorates `req.session` with `{ userId, tenantId }`,
and rejects invalid/expired tokens with 401.

## 2. Dependencies

- Block 011 — `parseSessionToken`.
- Block 012 — Fastify instance with `db` decorator.

## 3. Scope

### `apps/api/src/plugins/session.ts`

Fastify plugin (`fastify-plugin`) that:
- Decorates `req` with `session: { userId: UserId; tenantId: TenantId } | null`.
- Provides `req.requireSession()` helper that throws 401 if `session` is null.
- Reads `Authorization: Bearer <token>` header; calls `parseSessionToken`.
- On invalid/missing token: sets `req.session = null` (does NOT auto-reject —
  public routes like `/health` and `/login` must remain accessible).

### Wire into `buildServer()`

Register the session plugin globally.

### `apps/api/__tests__/session-middleware.test.ts`

- Request with valid token: `req.session` populated.
- Request with expired token: `req.session` is null.
- Request with no header: `req.session` is null.
- Protected route calling `requireSession()` with no token: returns 401.

## 4. Validation

- `pnpm --filter @saas/api typecheck` passes.
- `pnpm --filter @saas/api lint` passes.
- `pnpm --filter @saas/api test` passes.

## 5. Tenant safety

- [x] `tenantId` extracted from JWT `tid` claim — not from request body.
- [x] Session cannot be forged without `SESSION_SECRET`.

## 6. Out of scope

- Tenant resolution beyond tenantId (Block 019).
- Role enforcement (Block 020).
- Token refresh.
