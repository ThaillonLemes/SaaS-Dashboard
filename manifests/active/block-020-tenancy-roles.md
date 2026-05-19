---
id: block-020-tenancy-roles
tier: M
kind: implementation
phase: Phase 1B — Tenancy
scope: phase-bound
status: Pending
domain: packages/tenancy
risk: medium
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-018-tenancy-tenant-table
  - block-019-tenancy-context-factory
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/TENANT.md
    - packages/tenancy/src/index.ts
    - packages/contracts/src/tenancy/types.ts
  modify:
    - packages/tenancy/src/index.ts
  create:
    - infrastructure/db/migrations/0006_tenancy_memberships.sql
    - packages/tenancy/src/roles.ts
    - packages/tenancy/__tests__/roles.test.ts
benchmarks: []
flags: []
metrics:
  - role_enforcement_passed_total
  - role_enforcement_failed_total
contracts_consumed:
  - packages/contracts/src/tenancy/types.ts
---

# Block 020 — Role definitions + enforcement

## 1. Purpose

Add a `memberships` table (user ↔ tenant ↔ role), real role resolution in
`getTenantContext`, and replace the `enforceRole` stub with a real check.

## 2. Dependencies

- Block 018 — tenant repository.
- Block 019 — `getTenantContext` (to update with real roles).

## 3. Scope

### Migration `0006_tenancy_memberships.sql`

```sql
CREATE TABLE memberships (
  id        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id   TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  role      TEXT NOT NULL,
  UNIQUE (user_id, tenant_id)
);
```

### `packages/tenancy/src/roles.ts`

- `getRolesForUser(userId, tenantId, db): Promise<Role[]>`.
- `enforceRole(ctx, required): void` — throws `TenancyError` code `FORBIDDEN`
  if `ctx.roles` doesn't include `required`.

### Update `getTenantContext`

Load real roles from `memberships` table instead of hardcoded `owner`.

### `packages/tenancy/__tests__/roles.test.ts`

- `enforceRole` passes when user has required role.
- `enforceRole` throws `FORBIDDEN` when role missing.
- `getTenantContext` returns correct roles from DB.

## 4. Validation

- `pnpm --filter @saas/tenancy typecheck` passes.
- `pnpm --filter @saas/tenancy lint` passes.
- `pnpm --filter @saas/tenancy test` passes.

## 5. Tenant safety

- [x] Role lookup scoped by `(userId, tenantId)` — no cross-tenant role escalation.
