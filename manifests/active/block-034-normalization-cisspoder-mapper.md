---
id: block-034-normalization-cisspoder-mapper
tier: M
kind: implementation
phase: Phase 1D — Normalization
scope: phase-bound
status: Pending
domain: packages/normalization
risk: high
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-031-normalization-canonical-model
  - block-033-normalization-mapping-framework
  - block-027-integrations-cisspoder-connector
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - packages/normalization/src/mapper.ts
    - packages/normalization/src/types.ts
    - packages/integrations/src/connectors/cisspoder/mappers.ts
    - phases/phase-1c/decisions.md
  modify:
    - packages/normalization/src/index.ts
  create:
    - packages/normalization/src/mappers/cisspoder/products.ts
    - packages/normalization/src/mappers/cisspoder/customers.ts
    - packages/normalization/src/mappers/cisspoder/orders.ts
    - packages/normalization/src/mappers/cisspoder/index.ts
    - packages/normalization/__tests__/cisspoder-mapper.test.ts
benchmarks: []
flags: []
metrics:
  - normalization_mapped_total
  - normalization_map_errors_total
contracts_consumed:
  - packages/contracts/src/normalization/index.ts
---

# Block 034 — CISSPoder mapper

## 1. Purpose

Implement `EntityMapper` for CISSPoder's product, customer, and order
`RawPayload` shapes, bridging the raw connector output (Phase 1C) to
canonical entities (Phase 1D).

## 2. Dependencies

- Block 031 — canonical entity types.
- Block 033 — `EntityMapper` interface + `MapperRegistry`.
- Block 027 — CISSPoder `RawPayload` shapes documented in
  `phases/phase-1c/decisions.md` (read to understand raw field names).

## 3. Scope

### `packages/normalization/src/mappers/cisspoder/products.ts`

```ts
export const cisspodorProductMapper: EntityMapper = {
  connectorName: 'cisspoder',
  entityType: 'product',
  map(payload: RawPayload): CanonicalProduct { ... }
};
```

Maps CISSPoder raw product fields (e.g. `item_code`, `item_name`,
`selling_price`, `warehouse_qty`) to `CanonicalProduct`.
Unknown / missing fields are captured in `data`.

### `packages/normalization/src/mappers/cisspoder/customers.ts`

```ts
export const cisspodorCustomerMapper: EntityMapper = {
  connectorName: 'cisspoder',
  entityType: 'customer',
  map(payload: RawPayload): CanonicalCustomer { ... }
};
```

### `packages/normalization/src/mappers/cisspoder/orders.ts`

```ts
export const cisspodorOrderMapper: EntityMapper = {
  connectorName: 'cisspoder',
  entityType: 'order',
  map(payload: RawPayload): CanonicalOrder { ... }
};
```

Maps `status` enum from CISSPoder values to `CanonicalOrderStatus` (Block 031).

### `packages/normalization/src/mappers/cisspoder/index.ts`

```ts
/** Register all three CISSPoder mappers into the provided registry. */
export function registerCisspodorMappers(registry: MapperRegistry): void {
  registry.register(cisspodorProductMapper);
  registry.register(cisspodorCustomerMapper);
  registry.register(cisspodorOrderMapper);
}
```

### `packages/normalization/__tests__/cisspoder-mapper.test.ts`

Use fixture `RawPayload` objects representing CISSPoder API responses:
- `cisspodorProductMapper.map` produces correct `CanonicalProduct` shape.
- `cisspodorCustomerMapper.map` produces correct `CanonicalCustomer` shape.
- `cisspodorOrderMapper.map` maps status string → `CanonicalOrderStatus`.
- Unknown raw fields are collected in `data`, not thrown away silently.
- Missing optional fields default to `undefined` (not `null` or `''`).

## 4. Validation

- `pnpm --filter @saas/normalization typecheck` passes.
- `pnpm --filter @saas/normalization lint` passes.
- `pnpm --filter @saas/normalization test` passes (pure unit tests, no DB).

## 5. Tenant safety

- [x] Mappers are pure functions — `tenantId` is threaded from `RawPayload`
  into the canonical entity, never inferred or defaulted.
