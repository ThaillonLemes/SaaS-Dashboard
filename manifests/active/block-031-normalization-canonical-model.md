---
id: block-031-normalization-canonical-model
tier: L
kind: implementation
phase: Phase 1D — Normalization
scope: phase-bound
status: Pending
domain: packages/normalization
risk: high
performance_critical: false
created_at: 2026-05-16
estimated_duration_days: 2
dependencies:
  - block-001-monorepo-skeleton
  - block-004-contracts-skeleton
parallel_with:
  - block-011-identity-password-auth
  - block-018-tenancy-tenant-table
  - block-025-integrations-connector-interface
  - block-037-ui-kit-design-tokens
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/DATABASE.md
    - packages/contracts/src/index.ts
    - decisions/ADR-0001-monorepo.md
    - decisions/ADR-0002-postgres-orm.md
  modify:
    - packages/contracts/src/index.ts
  create:
    - phases/phase-1d/decisions.md
    - packages/normalization/package.json
    - packages/normalization/tsconfig.json
    - packages/normalization/README.md
    - packages/normalization/src/index.ts
    - packages/normalization/src/entities/product.ts
    - packages/normalization/src/entities/customer.ts
    - packages/normalization/src/entities/order.ts
    - packages/normalization/src/mapper.ts
    - packages/normalization/__tests__/mapper.test.ts
    - packages/contracts/src/normalization/index.ts
benchmarks: []
flags: []
metrics: []
contracts_consumed:
  - packages/contracts/src/tenancy/index.ts
---

# Block 031 — Canonical model design + bootstrap

## 1. Purpose

Bootstrap `packages/normalization` and define the canonical entity types
(Product, Customer, Order) that all ERP connectors map their raw payloads
into. Also documents the canonical model decision in `phases/phase-1d/decisions.md`.

## 2. Dependencies

- Block 001 — workspace tooling.
- Block 004 — contracts (TenantId for entity scoping).

## 3. Scope

### Canonical model decision (`phases/phase-1d/decisions.md`)

Document: which entities are canonical in Phase 1D (Product, Customer, Order),
what fields each must have, how optional ERP-specific fields are handled
(via `extensions: Record<string, unknown>`), and the mapping contract
(`mapErpXxxToCanonical` function signature).

### Canonical entity types (`packages/contracts/src/normalization/index.ts`)

```ts
export interface CanonicalProduct {
  readonly tenantId: TenantId;
  readonly externalId: string;
  readonly connectorName: string;
  readonly sku: string;
  readonly name: string;
  readonly priceAmount: number;
  readonly priceCurrency: string;
  readonly extensions: Record<string, unknown>;
  readonly syncedAt: Date;
}

export interface CanonicalCustomer { /* similar shape */ }
export interface CanonicalOrder { /* similar shape */ }
```

### Mapper interface (`packages/normalization/src/mapper.ts`)

```ts
export interface ErpMapper<T> {
  readonly connectorName: string;
  map(raw: RawPayload, tenantId: TenantId): T;
}
```

### Stub entity modules

`entities/product.ts`, `entities/customer.ts`, `entities/order.ts` — each
exports the canonical type re-exported from contracts plus a `validate`
function that checks required fields.

## 4. Validation

- `pnpm --filter @saas/normalization typecheck` passes.
- `pnpm --filter @saas/normalization lint` passes.
- `pnpm --filter @saas/normalization test` passes:
  - `ErpMapper` implementation for a mock payload compiles without type errors.
  - `validate` rejects payloads missing required fields.

## 5. Tenant safety check

- [x] All canonical entities carry `tenantId` — storage queries (Block 032) partition by it.

## 6. Out of scope

- Canonical entity DB tables (Block 032).
- Mapping framework implementation (Block 033).
- CISSPoder mapper (Block 034 — depends on Block 027).
- Deduplication (Block 035).
