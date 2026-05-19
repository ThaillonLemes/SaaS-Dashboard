---
id: block-019-tenancy-context-factory
tier: M
kind: implementation
phase: Phase 1B — Tenancy
scope: phase-bound
status: Pending
domain: packages/tenancy
risk: high
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-018-tenancy-tenant-table
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/TENANT.md
    - packages/tenancy/src/index.ts
    - packages/tenancy/src/repository.ts
    - packages/contracts/src/tenancy/types.ts
  modify:
    - packages/tenancy/src/index.ts
  create:
    - packages/tenancy/src/context.ts
    - packages/tenancy/__tests__/context.test.ts
benchmarks: []
flags: []
metrics:
  - tenant_context_resolved_total
  - tenant_context_failed_total
contracts_consumed:
  - packages/contracts/src/tenancy/types.ts
---

# Block 019 — TenantContext factory

## 1. Purpose

Replace the `getTenantContext` stub (from Block 006) with a real DB-backed
implementation that resolves `TenantContext` from `(userId, tenantId)`.

## 2. Dependencies

- Block 018 — `getTenantById`, tenants table.

## 3. Scope

### `packages/tenancy/src/context.ts`

Real implementation of `getTenantContext(userId, tenantId, db)`:
- Loads tenant from DB via `getTenantById`.
- Throws `TenancyError` with code `TENANT_NOT_FOUND` if absent or soft-deleted.
- Loads user's roles for this tenant (for now: owner role hardcoded — Phase 1B
  Block 020 adds real role resolution).
- Returns `TenantContext` matching the contracts type.

### Replace stub in `packages/tenancy/src/index.ts`

Wire real `getTenantContext` from `context.ts` instead of the stub.

### `packages/tenancy/__tests__/context.test.ts`

- Existing tenant resolves correctly.
- Unknown tenant throws `TENANT_NOT_FOUND`.
- Soft-deleted tenant throws `TENANT_NOT_FOUND`.

## 4. Validation

- `pnpm --filter @saas/tenancy typecheck` passes.
- `pnpm --filter @saas/tenancy lint` passes.
- `pnpm --filter @saas/tenancy test` passes.

## 5. Tenant safety

- [x] Context is always scoped to the requested `tenantId` — no cross-tenant resolution.

## 6. Out of scope

- Real role resolution (Block 020).
- Plan limit resolution (Block 021).
