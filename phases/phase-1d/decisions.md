# Phase 1D — Decisions

_Architectural calls made during Phase 1D (Normalization). Append as
decisions land. Full ADRs live in `./decisions/ADR-NNNN-*.md`; this
file is the index + short-form rationale._

---

## D-1D.1 — Canonical entities in Phase 1D: Product, Customer, Order

**Decided:** Block 031.

The canonical model in Phase 1D covers three entities — and only three:

| Entity              | Why canonical here                                                                                  |
|---------------------|-----------------------------------------------------------------------------------------------------|
| `CanonicalProduct`  | Every ERP exposes a product / SKU catalog; this is the highest-shared shape across connectors.      |
| `CanonicalCustomer` | Sales, billing, and dashboard segmentation all key off customer identity.                           |
| `CanonicalOrder`    | The transactional fact table — totals, currency, status, and timing feed every downstream KPI.      |

Not yet canonical (deferred):

- **Invoices / NFe / NFC-e** — fiscal documents are downstream of orders and
  carry CFOP / regime / tax-substitution detail (D-0.7 Brazilian retail
  context). Phase 2 or later.
- **Inventory movements / stock counts** — needed for KPIs but cardinality
  and temporal semantics differ from orders; revisit when the first KPI
  block asks for them.
- **Suppliers, employees, payment terms, accounts** — wait for a concrete
  consumer block to drive the shape.

Per Q1 — the canonical model holds three entities because three are
required. Adding a fourth is an additive contract change (D2) that
goes through a new ADR / block.

---

## D-1D.2 — Required fields per canonical entity

**Decided:** Block 031.

All three entities share five required canonical fields:

- `tenantId: TenantId` — branded; the storage and partition key (T1).
- `externalId: string` — the connector's stable primary key for the entity
  in its source ERP. The pair `(connectorName, externalId)` is the natural
  upsert key for the storage layer (Block 032).
- `connectorName: string` — names the producer connector
  (e.g. `'cisspoder'`). Provenance is a first-class field, not a
  log-only attribute, so downstream queries can filter by source ERP.
- `extensions: Record<string, unknown>` — see D-1D.3 below.
- `syncedAt: Date` — when the canonical row was minted from the raw
  payload. Used by Block 035 (dedup) to pick winners on conflict.

Per-entity required fields beyond the shared five:

| Entity              | Additional required fields                                                       |
|---------------------|----------------------------------------------------------------------------------|
| `CanonicalProduct`  | `sku`, `name`, `priceAmount: number`, `priceCurrency: string`                    |
| `CanonicalCustomer` | `name` (email, phone are optional — many ERPs leave them blank)                  |
| `CanonicalOrder`    | `customerId`, `totalAmount`, `currency`, `status`, `issuedAt: Date`              |

`CanonicalOrder.status` is a discriminated string union — see D-1D.4.

---

## D-1D.3 — ERP-specific fields go into `extensions: Record<string, unknown>`

**Decided:** Block 031.

The canonical model is intentionally lean. ERP-specific fields that don't
fit the canonical shape (CFOP, regime tributário, custom tags,
warehouse codes, etc.) are folded into `extensions` by the connector's
mapper.

Constraints:

- `extensions` is `Record<string, unknown>` — the canonical layer makes
  no claim about the inner shape. Consumers that need a specific
  extension key narrow it themselves at the point of use.
- `extensions` is **never** `null` — it is `{}` when empty. This keeps
  the storage column NOT NULL (Block 032) and the validator check
  uniform.
- Extensions are read-only contracts: the connector's mapper writes,
  no other code mutates. (Storage layer in Block 032 persists the
  blob as JSONB.)

Trade-off accepted: the type system does not protect against an
extension key being read with the wrong type — by design. The
alternative (per-connector branded subtypes via generics on the
canonical entity) was rejected as premature abstraction (Q1, rule of
three: we have one connector planned).

---

## D-1D.4 — `CanonicalOrderStatus` is a five-tag discriminated union

**Decided:** Block 031.

`CanonicalOrder.status` is one of:

```
'pending' | 'confirmed' | 'fulfilled' | 'cancelled' | 'refunded'
```

Rationale: the Brazilian retail / wholesale flow (D-0.7 CISSPoder) is
`pedido → confirmação → faturamento (NFe) → entrega → (eventual)
cancelamento ou devolução`. The five canonical statuses cover this
without leaking ERP vocabulary. Mappers translate connector statuses
to this set.

The union is additive (D2). Widening it later (e.g. adding
`'in_transit'`) is non-breaking for consumers that switch on known
tags; consumers using exhaustive `switch` adopt the new tag in their
next block.

Free-form `status: string` was rejected because it pushes status
semantics into prose — a downstream KPI block cannot compute
"fulfilled-this-month" without re-establishing the vocabulary (TS5).

---

## D-1D.5 — Mapping contract: `ErpMapper<T>` interface

**Decided:** Block 031.

```ts
export interface ErpMapper<T> {
  readonly connectorName: string;
  map(raw: RawPayload, tenantId: TenantId): T;
}
```

- One `ErpMapper<T>` instance per (connector, canonical-entity) pair.
  A CISSPoder integration ships three: `ErpMapper<CanonicalProduct>`,
  `ErpMapper<CanonicalCustomer>`, `ErpMapper<CanonicalOrder>`.
- `RawPayload = Record<string, unknown>` — the contract type for the
  untyped wire shape of an ERP response item. The mapper IS the
  boundary at which `unknown` becomes a typed canonical entity
  (TS3, Q2); defensive checks inside the system are forbidden.
- The mapper synchronously returns a canonical instance. Network I/O,
  pagination, and rate-limit handling are the connector's
  responsibility (Block 025 contract), not the mapper's.

The contract intentionally returns `T`, not `T | null` and not
`Result<T, E>` — a mapper that cannot produce a canonical row throws.
The mapping framework (Block 033) catches at the per-row boundary so
one bad row does not poison a batch.

---

## D-1D.6 — Monetary values are JS `number`

**Decided:** Block 031.

`priceAmount` and `totalAmount` are typed `number`. Trade-offs:

- ✅ Simpler arithmetic, JSON-serializable, indexable in Postgres
  (mapped to `numeric` in Block 032 to preserve precision).
- ❌ IEEE-754 imprecision at fractional decimals. Sums larger than
  `2^53` cents overflow precision (≈ $90 trillion).

Accepted because Phase 1D consumers are dashboards summing per-tenant
revenue, where SMB-scale tenants stay well below the precision
ceiling. If a future block needs sub-cent accuracy (FX conversion,
high-frequency trading-style aggregation), `priceAmount` widens
additively to `number | { amount: bigint; scale: number }` via a new
contract block.

`priceCurrency` and `Order.currency` are ISO-4217 three-letter strings
(`'USD'`, `'BRL'`). Not validated at this contract layer; the storage
layer in Block 032 will add a CHECK constraint.

---

## D-1D.7 — `syncedAt` / `issuedAt` are JS `Date`

**Decided:** Block 031.

The temporal fields are `Date` objects. The mapper constructs them at
the boundary (typically `new Date(raw.timestampString)`). The
storage layer (Block 032) writes them as `timestamptz`.

`Date` was chosen over an ISO-8601 string because:
- It removes ambiguity in arithmetic at the canonical layer (the
  validate functions and downstream code call `.getTime()`, not
  string comparison).
- Cross-package transmission inside the workspace happens via
  JS objects, not JSON wire — `Date` survives.

JSON serialization is the API layer's concern (Block 022 onwards) and
will format these as ISO strings.

---

## D-1D.8 — Validation lives next to the canonical type, not in contracts

**Decided:** Block 031.

`packages/contracts/src/normalization/` exports types only — zero
runtime code, matching the contracts package's stated invariant
(D1 / D2 / `packages/contracts/package.json` `dependencies: {}`).

`packages/normalization/src/entities/{product,customer,order}.ts`
each export a `validate(entity)` runtime function that throws on
missing required fields or invalid shapes. These validators are the
post-map / pre-persist boundary used by Block 033's mapping framework.

The shared assertion primitives (`requireString`, `requireFiniteNumber`,
`requireDate`, `requireObject`) live in
`packages/normalization/src/internal/asserts.ts` (per TS7 — not
re-exported from `index.ts`).

`validate` throws plain `Error` with a message of the form
`'CanonicalProduct.sku: missing or empty'`. A dedicated
`NormalizationError` class is deferred to Block 033, where the
mapping framework needs a structured error to record per-row
failures in batch operations.
