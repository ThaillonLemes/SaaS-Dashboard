# `packages/integrations` — ERP connector interface

## Identity

`@saas/integrations` owns the contract every ERP adapter implements. It
publishes the `ErpConnector` interface and the `IntegrationError` shape
that the pull scheduler ([block-028](../../manifests/active/)) and the
raw-payload storage layer ([block-029](../../manifests/active/)) depend
on.

The Phase 1C skeleton (block-025) lands the types only — concrete
adapters (CISSPoder in block-027, others later) implement the interface
in their own modules and register themselves with the scheduler.

---

## What this owns

- `ErpConnector` — interface (`name`, `version`, `connect`, `pull`,
  `disconnect`).
- `ConnectorConfig` — connect-time payload (`tenantId`, `credentials`,
  optional `baseUrl`).
- `RawPayload` — single pre-normalization record (`tenantId`,
  `entityType`, `externalId`, `pulledAt`, `raw`).
- `IntegrationError` — domain error with `code` discriminant
  (`CONNECTION_FAILED`, `AUTH_FAILED`, `PULL_FAILED`, `RATE_LIMITED`).
- The standard metric names every adapter emits — see [§ Metrics](#metrics).

## What this does NOT own

- **Connection persistence** — `tenant_erp_connections` table lives in
  the Phase 1C block-026 (database) work.
- **First concrete connector** — CISSPoder adapter lands in block-027.
- **Pull scheduling** — block-028 owns the cron/queue that drives
  `pull()` calls.
- **Raw-payload storage** — block-029 owns the partitioned table that
  persists `RawPayload[]`.
- **Canonical-model normalization** — `packages/normalization` (block-031)
  consumes `RawPayload` and emits domain entities.
- **Cross-domain types** — `TenantId` lives in `@saas/contracts`. This
  package depends on it but does not re-export it.

Per D1, this package never reaches into another package's internals —
imports go through `@saas/contracts` and `@saas/observability` only.

---

## Public surface (`src/index.ts`)

```ts
export type { ConnectorConfig, ErpConnector, RawPayload } from './connector';
export { IntegrationError } from './errors';
```

Consumers depend on the interface shape, not on any implementation
detail (P5). Adding a method to `ErpConnector` is a breaking change to
every adapter — guard it behind a new interface or a discriminated
union per TS5.

Cross-domain types in `packages/contracts/`:
- `TenantId` (`tenancy/types.ts`) — the partition key carried by
  `ConnectorConfig` and `RawPayload`.

---

## Internal structure

```
packages/integrations/
├── src/
│   ├── index.ts        ← public surface (4 exports)
│   ├── connector.ts    ← ErpConnector, ConnectorConfig, RawPayload
│   └── errors.ts       ← IntegrationError
├── __tests__/
│   └── connector.test.ts  ← MockConnector + error-code + tenantId assertions
├── package.json
├── tsconfig.json
└── README.md           ← this file
```

---

## Dependencies

- **Runtime:** `@saas/contracts` — `TenantId` only; types only.
- **Runtime:** `@saas/observability` — declared for concrete adapters
  (block-027+) to emit `connector_pull_*` metrics and spans without
  re-adding the dep. The skeleton itself has no telemetry call sites.
- **Dev:** `typescript`, `vitest`, `@types/node`.

No deep imports from any `@saas/*` package (D1). Enforced by
`no-restricted-imports` in the workspace `.eslintrc.cjs`.

---

## Database tables

None here. Adjacent blocks land the tables that consume this contract:

- `tenant_erp_connections` (block-026) — one row per
  `(tenant_id, connector_name)` pair, holds opaque credentials.
- `raw_payloads` (block-029) — partitioned by `tenant_id`, one row per
  `RawPayload` returned by `pull()`.

All tenant-scoped tables carry `tenant_id NOT NULL` and an RLS policy
`tenant_id = current_setting('app.tenant_id')` per T-3 in the tenant
addendum.

---

## Tenant safety

- `ConnectorConfig.tenantId` (T1) — every `connect()` call is scoped to
  one tenant. Implementations MUST use the supplied credentials only
  against the named tenant's external account; sharing a single
  connection across tenants is a class-T1 bug.
- `pull(tenantId)` (T1) — the argument is the partition key for the
  returned `RawPayload[]`. Returning records for a tenant other than the
  argument is a class-T1 bug.
- `RawPayload.tenantId` (T1) — the storage layer (block-029) partitions
  by this column; the value is the same `tenantId` passed to `pull()`.

Cross-tenant ERP queries (e.g. for support tooling) use `AdminContext`
in a separate code path — not this interface.

---

## Cross-cutting concerns

- **Tenancy:** every type in the public surface carries `tenantId`
  (T1).
- **Observability:** concrete adapters emit the metrics in
  [§ Metrics](#metrics) and wrap `pull()` in
  `withSpan('connector.pull', { connector: this.name })` per the
  observability protocol.
- **Errors:** thrown errors are `IntegrationError` instances with a
  stable `code` discriminant (TS4 Style B inside the package). The
  pull-scheduler boundary (block-028) converts to `Result` shapes when
  crossing the package boundary.

---

## Metrics

Concrete adapters MUST emit (registered by the scheduler — block-028):

- `connector_pull_total{connector,tenant_id,result}` — counter.
- `connector_pull_duration_seconds{connector,tenant_id}` — histogram.
- `connector_pull_errors_total{connector,tenant_id,code}` — counter,
  `code` is the `IntegrationError.code` value.

The skeleton block-025 ships the interface only; the metric
registration block lands with the scheduler.

---

## Testing

```
pnpm --filter @saas/integrations test
```

The smoke tests in `__tests__/connector.test.ts` cover:

- A `MockConnector` implementing `ErpConnector` compiles and round-trips
  a payload.
- `RawPayload` carries the `tenantId` it was constructed with.
- `IntegrationError` exposes each of the four `code` variants verbatim
  and is an `Error` / `IntegrationError` subclass with name
  `'IntegrationError'`.

Tenant-isolation tests (per T-9) become mandatory when the first
concrete adapter (block-027) lands.

---

## Current state

Skeleton only. Phase 1C blocks fill in:

- 026 — `tenant_erp_connections` table + connection-CRUD service.
- 027 — first adapter (CISSPoder) implementing `ErpConnector`.
- 028 — pull scheduler (cron / pg-boss) that drives `connect → pull →
  disconnect` cycles.
- 029 — raw-payload storage, partitioned by `tenant_id`.

Cross-domain state in the workspace [`STATE.md`](../../STATE.md).

---

## How to add to this domain

1. Read this file + [`PROTOCOLS.md`](../../PROTOCOLS.md) +
   [`protocols/TYPESCRIPT.md`](../../protocols/TYPESCRIPT.md) +
   [`protocols/API.md`](../../protocols/API.md) +
   [`protocols/TENANT.md`](../../protocols/TENANT.md).
2. Read [`ADR-0001`](../../decisions/ADR-0001-monorepo.md) for the
   workspace topology and D1 boundary rules.
3. Author a block manifest from
   [`templates/manifest-M.md`](../../templates/manifest-M.md) (or
   `manifest-L.md` for cross-package changes such as adding a method
   to `ErpConnector`).
4. Implement within manifest scope (C2). Cross-package changes go
   through `packages/contracts/` first (D2).
5. Validate per manifest: typecheck, lint, test. Include
   tenant-isolation tests once the adapter touches the network (T-9).
6. Open PR; tag for Governor review.
