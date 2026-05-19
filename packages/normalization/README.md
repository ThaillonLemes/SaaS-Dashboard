# `packages/normalization` — canonical entity model + ERP mapper contract

## Identity

The bounded context that defines the **canonical shape** every ERP
connector maps its raw payloads into — `CanonicalProduct`,
`CanonicalCustomer`, `CanonicalOrder` — and publishes the mapping
contract `ErpMapper<T>` that connectors implement.

This is the **Phase 1D foundation** (Block 031). The public surface
freezes here; later Phase 1D blocks build on top: Block 032 lands the
storage tables and repositories, Block 033 lands the mapping
framework, Block 034 lands the first concrete (CISSPoder) mapper,
Block 035 lands deduplication and validation.

---

## What this owns

- The **canonical entity types** — `CanonicalProduct`,
  `CanonicalCustomer`, `CanonicalOrder` — published as TypeScript
  interfaces in `@saas/contracts/normalization/`.
- The **canonical order status vocabulary** — `CanonicalOrderStatus`
  — also published in `@saas/contracts/normalization/`.
- The **`ErpMapper<T>` interface** — the mapping contract every
  connector implements.
- The **`validate(entity)` functions** — one per canonical entity, used
  at the post-map / pre-persist boundary.

## What this does NOT own

- **Persistence of canonical entities** — DB tables and repositories
  land in Block 032 (`packages/normalization` will grow them).
- **The mapping framework** — orchestration of pull → map → dedup →
  persist lands in Block 033.
- **Concrete ERP connectors** — `packages/integrations` (Block 025)
  publishes the connector interface; Block 034 builds the first
  concrete one (CISSPoder).
- **Deduplication and post-validation policy** — Block 035.

Per D1, this package never reaches into other packages' internals.

---

## Public surface (`src/index.ts`)

```ts
export type { ErpMapper } from './mapper';

export { validateProduct, type CanonicalProduct } from './entities/product';
export { validateCustomer, type CanonicalCustomer } from './entities/customer';
export {
  validateOrder,
  type CanonicalOrder,
  type CanonicalOrderStatus,
} from './entities/order';

export type { RawPayload } from '@saas/contracts';
```

Types from `@saas/contracts/normalization/`:
- `CanonicalProduct`, `CanonicalCustomer`, `CanonicalOrder`
- `CanonicalOrderStatus`
- `RawPayload`

---

## Internal structure

```
packages/normalization/
├── src/
│   ├── index.ts                 ← public surface
│   ├── mapper.ts                ← ErpMapper<T> interface
│   ├── entities/
│   │   ├── product.ts           ← validate + CanonicalProduct re-export
│   │   ├── customer.ts          ← validate + CanonicalCustomer re-export
│   │   └── order.ts             ← validate + CanonicalOrder re-export
│   └── internal/
│       └── asserts.ts           ← field-presence helpers (not exported)
├── __tests__/
│   └── mapper.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

The `internal/` modules are not re-exported (TS7). Phase 1D follow-up
blocks will add `src/repository.ts` (Block 032), `src/framework.ts`
(Block 033), and `src/dedup.ts` (Block 035) — none of those exist
yet.

---

## Dependencies

- `@saas/contracts` — canonical types and `TenantId` brand.

No `@saas/observability` dependency yet — added in Block 033 when the
mapping framework emits per-row spans and error metrics. No deep
imports (D1).

---

## Database tables

None at Block 031. Block 032 lands:
- `canonical_products` — tenant-scoped, RLS-protected. Natural key:
  `(tenant_id, connector_name, external_id)`.
- `canonical_customers` — same shape.
- `canonical_orders` — same shape, plus `customer_id` FK.

All three are tenant-scoped with `tenant_id NOT NULL` + RLS policy
(per T1).

---

## Cross-cutting concerns

- **Tenancy:** every canonical entity carries `tenantId` from creation
  (Block 031) through persistence (Block 032) through queries. The
  mapper receives `tenantId` as a positional argument so it cannot
  be forgotten.
- **Observability:** no spans / logs at Block 031 (no I/O yet).
  Block 033's mapping framework adds per-row tracing.
- **Errors:** `validate` throws plain `Error` with messages of the
  form `'CanonicalProduct.<field>: <reason>'`. Phase 1D Block 033
  introduces `NormalizationError` for structured per-row failure
  reporting in batch operations.

---

## Testing

```
pnpm --filter @saas/normalization test
```

Phase 1D Block 031 covers:
- `ErpMapper<CanonicalProduct>` implementations compile and produce
  canonical instances.
- `validate*` rejects payloads missing required fields, wrong-typed
  numbers, and out-of-vocabulary order statuses.
- `validate*` accepts complete, well-typed payloads (including
  optional `email`/`phone` on customers, both omitted and present).

Block 033 adds: framework-level batch tests, per-row error capture
tests. Block 034 adds: CISSPoder mapper tests with realistic
fixtures.

---

## Current state

Phase 1D foundation only — see [phase decisions](../../phases/phase-1d/decisions.md)
and [block manifest](../../manifests/active/block-031-normalization-canonical-model.md)
for what landed in Block 031.

---

## How to add to this domain

1. Read this file + `../../PROTOCOLS.md` + `../../protocols/TYPESCRIPT.md`.
2. Read `../../protocols/DATABASE.md` if touching persistence (Block 032+).
3. Read `../../phases/phase-1d/decisions.md` for canonical-model rules.
4. Author a block manifest from `../../templates/manifest-M.md`.
5. Implement within manifest scope (C2).
6. Validate: typecheck, lint, test.
7. Open PR; tag for Governor review.
