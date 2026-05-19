---
id: block-023-tenancy-onboarding-ui
tier: M
kind: implementation
phase: Phase 1B — Tenancy
scope: phase-bound
status: Pending
domain: apps/web
risk: low
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-014-identity-login-ui
  - block-022-tenancy-crud-api
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/REACT.md
    - apps/web/src/routes/login.tsx
    - apps/web/src/hooks/useAuth.ts
  modify: []
  create:
    - apps/web/src/routes/onboarding.tsx
    - apps/web/src/api/tenants.ts
    - apps/web/__tests__/onboarding.test.tsx
benchmarks: []
flags: []
metrics: []
contracts_consumed: []
---

# Block 023 — Tenant onboarding UI

## 1. Purpose

Add a `/onboarding` route where new users create their first tenant after
logging in. After creation, redirect to `/dashboard` (stub).

## 2. Dependencies

- Block 014 — `useAuth` hook (session token).
- Block 022 — `POST /tenants` endpoint.

## 3. Scope

### `apps/web/src/api/tenants.ts`

`createTenant(name, slug, token): Promise<Tenant>` — calls `POST /tenants`.

### `apps/web/src/routes/onboarding.tsx`

Form with tenant `name` and `slug` fields. On submit calls `createTenant`.
On success redirects to `/dashboard`. Shows inline validation errors.

### `apps/web/__tests__/onboarding.test.tsx`

- Form renders name + slug fields.
- Submit calls `createTenant` with correct args.
- Success redirects to `/dashboard`.
- API error shows inline message.

## 4. Validation

- `pnpm --filter @saas/web typecheck` passes.
- `pnpm --filter @saas/web lint` passes.
- `pnpm --filter @saas/web test` passes.
