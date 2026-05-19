---
id: block-018-tenancy-tenant-table
tier: M
kind: implementation
phase: Phase 1B — Tenancy
scope: phase-bound
status: Pending
domain: packages/tenancy
risk: medium
performance_critical: false
created_at: 2026-05-16
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
  - block-002-postgres-baseline
  - block-004-contracts-skeleton
  - block-006-tenancy-skeleton
parallel_with:
  - block-011-identity-password-auth
  - block-025-integrations-connector-interface
  - block-031-normalization-canonical-model
  - block-037-ui-kit-design-tokens
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/DATABASE.md
    - protocols/TENANT.md
    - packages/contracts/src/tenancy/index.ts
    - packages/tenancy/src/index.ts
    - infrastructure/db/drizzle.config.ts
    - decisions/ADR-0002-postgres-orm.md
  modify:
    - packages/tenancy/src/index.ts
    - packages/contracts/src/tenancy/index.ts
    - infrastructure/db/migrations/0001_init.sql
  create:
    - infrastructure/db/migrations/0003_tenancy_tenants.sql
    - packages/tenancy/src/repository.ts
    - packages/tenancy/src/schema.ts
    - packages/tenancy/__tests__/repository.test.ts
benchmarks: []
flags: []
metrics:
  - tenants_total
contracts_consumed:
  - packages/contracts/src/tenancy/index.ts
---

# Block 018 — Tenant table + repository

## 1. Purpose

Land the `tenants` Postgres table and a typed Drizzle repository in
`packages/tenancy`. This is the data foundation for every subsequent
tenancy block (context factory, roles, plan limits).

## 2. Dependencies

- Block 001 — workspace tooling.
- Block 002 — Postgres + Drizzle migration runner.
- Block 004 — contracts (TenantId, TenantContext types).
- Block 006 — tenancy skeleton (public surface to fill in).

## 3. Scope

### Migration (`0003_tenancy_tenants.sql`)

```sql
CREATE TABLE tenants (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  plan_tier   TEXT NOT NULL DEFAULT 'starter',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
```

### `packages/tenancy/src/schema.ts`

Drizzle table definition for `tenants` using `pgTable`.

### `packages/tenancy/src/repository.ts`

- `getTenantById(id: TenantId, db: DrizzleDb): Promise<Tenant | null>`.
- `getTenantBySlug(slug: string, db: DrizzleDb): Promise<Tenant | null>`.
- `createTenant(data: NewTenant, db: DrizzleDb): Promise<Tenant>`.
- `softDeleteTenant(id: TenantId, db: DrizzleDb): Promise<void>` — sets `deleted_at`.
- All queries exclude soft-deleted tenants by default.

### Contracts update

Export `Tenant` and `NewTenant` types from `packages/contracts/src/tenancy/index.ts`.

## 4. Validation

- `pnpm --filter @saas/tenancy typecheck` passes.
- `pnpm --filter @saas/tenancy lint` passes.
- `pnpm --filter @saas/tenancy test` passes:
  - `createTenant` + `getTenantById` round-trip.
  - `getTenantBySlug` returns null for unknown slug.
  - Soft-deleted tenant not returned by default queries.
- Migration `0003_tenancy_tenants.sql` runs idempotently.

## 5. Tenant safety check

- [x] All repository functions are tenant-scoped by design — no cross-tenant reads possible (each function targets a specific tenant ID).
- [x] Soft delete preserves audit trail (T1 data safety).

## 6. Out of scope

- `getTenantContext` factory (Block 019).
- Role enforcement (Block 020).
- Plan limit enforcement (Block 021).
- Tenant CRUD API (Block 022).
