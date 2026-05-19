---
id: block-032-normalization-canonical-tables
tier: M
kind: implementation
phase: Phase 1D — Normalization
scope: phase-bound
status: Pending
domain: packages/normalization
risk: medium
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-031-normalization-canonical-model
parallel_with:
  - block-033-normalization-mapping-framework
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/DATABASE.md
    - packages/normalization/src/index.ts
    - packages/normalization/src/types.ts
    - decisions/ADR-0002-postgres-orm.md
  modify:
    - packages/normalization/src/index.ts
  create:
    - infrastructure/db/migrations/0009_normalization_canonical.sql
    - packages/normalization/src/schema.ts
    - packages/normalization/src/repository.ts
    - packages/normalization/__tests__/repository.test.ts
benchmarks: []
flags: []
metrics:
  - canonical_entities_stored_total
contracts_consumed:
  - packages/contracts/src/normalization/index.ts
---

# Block 032 — Canonical entity tables + repositories

## 1. Purpose

Create Postgres tables for canonical products, customers, and orders.
Expose Drizzle-based repository functions used by the normalization pipeline
(Block 035) and downstream API routes.

## 2. Dependencies

- Block 031 — `CanonicalProduct`, `CanonicalCustomer`, `CanonicalOrder` types.

## 3. Scope

### Migration `0009_normalization_canonical.sql`

```sql
CREATE TABLE canonical_products (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT NOT NULL,
  connector_name TEXT NOT NULL,
  external_id    TEXT NOT NULL,
  name           TEXT NOT NULL,
  sku            TEXT,
  price          NUMERIC(12,4),
  currency       TEXT,
  stock          INTEGER,
  data           JSONB NOT NULL DEFAULT '{}',
  normalized_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_name, external_id)
);

CREATE TABLE canonical_customers (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT NOT NULL,
  connector_name TEXT NOT NULL,
  external_id    TEXT NOT NULL,
  name           TEXT NOT NULL,
  email          TEXT,
  phone          TEXT,
  data           JSONB NOT NULL DEFAULT '{}',
  normalized_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_name, external_id)
);

CREATE TABLE canonical_orders (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT NOT NULL,
  connector_name TEXT NOT NULL,
  external_id    TEXT NOT NULL,
  status         TEXT NOT NULL,
  customer_id    TEXT,
  total_amount   NUMERIC(12,4),
  currency       TEXT,
  ordered_at     TIMESTAMPTZ,
  data           JSONB NOT NULL DEFAULT '{}',
  normalized_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_name, external_id)
);

CREATE INDEX canonical_products_tenant_idx
  ON canonical_products (tenant_id, connector_name);
CREATE INDEX canonical_customers_tenant_idx
  ON canonical_customers (tenant_id, connector_name);
CREATE INDEX canonical_orders_tenant_idx
  ON canonical_orders (tenant_id, connector_name);
```

### `packages/normalization/src/schema.ts`

Drizzle table definitions mirroring the migration above:
- `canonicalProducts`, `canonicalCustomers`, `canonicalOrders` tables.
- Export inferred `Select*` / `Insert*` types.

### `packages/normalization/src/repository.ts`

```ts
// Products
export async function upsertProduct(
  product: CanonicalProduct, db: DrizzleDb
): Promise<void>;

export async function getProducts(
  tenantId: string, connectorName: string, db: DrizzleDb
): Promise<CanonicalProduct[]>;

// Customers
export async function upsertCustomer(
  customer: CanonicalCustomer, db: DrizzleDb
): Promise<void>;

export async function getCustomers(
  tenantId: string, connectorName: string, db: DrizzleDb
): Promise<CanonicalCustomer[]>;

// Orders
export async function upsertOrder(
  order: CanonicalOrder, db: DrizzleDb
): Promise<void>;

export async function getOrders(
  tenantId: string, connectorName: string, db: DrizzleDb
): Promise<CanonicalOrder[]>;
```

All upserts use `ON CONFLICT (tenant_id, connector_name, external_id) DO UPDATE`
setting `updated_at = now()` and the mutated columns.

### `packages/normalization/__tests__/repository.test.ts`

- `upsertProduct` + `getProducts` round-trip, no duplicate on re-upsert.
- `upsertCustomer` + `getCustomers` round-trip.
- `upsertOrder` + `getOrders` round-trip.
- Each query is scoped to `tenantId` — other tenant's rows are not returned.

## 4. Validation

- `pnpm --filter @saas/normalization typecheck` passes.
- `pnpm --filter @saas/normalization lint` passes.
- `pnpm --filter @saas/normalization test` passes.

## 5. Tenant safety

- [x] All queries filter by `tenant_id` — no cross-tenant entity access.
