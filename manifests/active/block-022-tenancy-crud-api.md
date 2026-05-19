---
id: block-022-tenancy-crud-api
tier: M
kind: implementation
phase: Phase 1B — Tenancy
scope: phase-bound
status: Pending
domain: apps/api
risk: medium
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-013-identity-session-middleware
  - block-019-tenancy-context-factory
  - block-020-tenancy-roles
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/API.md
    - protocols/TENANT.md
    - apps/api/src/index.ts
    - packages/tenancy/src/repository.ts
  modify:
    - apps/api/src/index.ts
  create:
    - apps/api/src/routes/tenants.ts
    - apps/api/__tests__/tenants.test.ts
benchmarks: []
flags: []
metrics:
  - tenant_created_total
  - tenant_fetched_total
contracts_consumed:
  - packages/contracts/src/tenancy/tenant.ts
---

# Block 022 — Tenant CRUD API

## 1. Purpose

Add tenant management endpoints to `apps/api`. Protected by session
middleware and role enforcement (`owner` only for mutations).

## 2. Dependencies

- Block 013 — session middleware (`req.requireSession()`).
- Block 019 — `getTenantContext`.
- Block 020 — `enforceRole`.

## 3. Scope

### `apps/api/src/routes/tenants.ts`

- `GET /tenants/:id` — returns tenant info (any authenticated member).
- `POST /tenants` — creates new tenant + owner membership for requesting user.
- `DELETE /tenants/:id` — soft-deletes tenant (`owner` role required).

### `apps/api/__tests__/tenants.test.ts`

- `GET /tenants/:id` returns 200 for valid tenant.
- `GET /tenants/:id` returns 404 for unknown tenant.
- `POST /tenants` creates tenant and returns 201.
- `DELETE /tenants/:id` without `owner` role returns 403.
- Unauthenticated requests return 401.

## 4. Validation

- `pnpm --filter @saas/api typecheck` passes.
- `pnpm --filter @saas/api lint` passes.
- `pnpm --filter @saas/api test` passes.

## 5. Tenant safety

- [x] All read operations verify the requesting user belongs to the tenant.
- [x] Mutations require `owner` role via `enforceRole`.
