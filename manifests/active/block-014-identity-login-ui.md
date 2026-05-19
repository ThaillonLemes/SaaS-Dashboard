---
id: block-014-identity-login-ui
tier: M
kind: implementation
phase: Phase 1A — Identity
scope: phase-bound
status: Pending
domain: apps/web
risk: low
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-008-web-shell
  - block-012-identity-login-endpoint
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/REACT.md
    - apps/web/src/routes/login.tsx
    - apps/web/package.json
  modify:
    - apps/web/src/routes/login.tsx
  create:
    - apps/web/src/api/auth.ts
    - apps/web/src/hooks/useAuth.ts
    - apps/web/src/store/auth.ts
    - apps/web/__tests__/login.test.tsx
benchmarks: []
flags: []
metrics: []
contracts_consumed: []
---

# Block 014 — Login UI

## 1. Purpose

Make `apps/web/src/routes/login.tsx` functional: email + password form that
calls `POST /login`, stores the session token, and redirects on success.

## 2. Dependencies

- Block 008 — React + Vite shell, `/login` route stub.
- Block 012 — `POST /login` API endpoint.

## 3. Scope

### `apps/web/src/api/auth.ts`

```ts
export async function apiLogin(email: string, password: string, tenantId: string)
  : Promise<{ token: string }>;
```

Calls `POST /login`. Throws on non-200.

### `apps/web/src/store/auth.ts`

Zustand store (or React context) holding `{ token: string | null }`.
`setToken(token)` / `clearToken()`. Persists to `sessionStorage`.

### `apps/web/src/hooks/useAuth.ts`

`useAuth()` — returns `{ token, login(email, password, tenantId), logout, isLoading, error }`.

### `apps/web/src/routes/login.tsx`

Form with email, password, tenantId fields. On submit calls `login()`.
On success redirects to `/dashboard` (stub route — 404 is fine for now).
Shows inline error on 401.

### `apps/web/__tests__/login.test.tsx`

- Form renders with email + password + tenantId fields.
- Submit calls `apiLogin` with correct args.
- 401 response shows error message.
- Success stores token and redirects.

## 4. Validation

- `pnpm --filter @saas/web typecheck` passes.
- `pnpm --filter @saas/web lint` passes.
- `pnpm --filter @saas/web test` passes.

## 5. Tenant safety

- [x] `tenantId` collected from the form — user explicitly picks their tenant.

## 6. Out of scope

- Tenant picker dropdown (Phase 1B Block 023).
- Remember me / persistent sessions.
- SSO.
