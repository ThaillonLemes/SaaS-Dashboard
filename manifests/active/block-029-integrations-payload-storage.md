---
id: block-029-integrations-payload-storage
tier: M
kind: implementation
phase: Phase 1C — Integrations
scope: phase-bound
status: Pending
domain: packages/integrations
risk: medium
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-025-integrations-connector-interface
  - block-026-integrations-connection-persistence
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/DATABASE.md
    - packages/integrations/src/connector.ts
    - decisions/ADR-0002-postgres-orm.md
  modify:
    - packages/integrations/src/index.ts
  create:
    - infrastructure/db/migrations/0008_integrations_raw_payloads.sql
    - packages/integrations/src/storage.ts
    - packages/integrations/__tests__/storage.test.ts
benchmarks: []
flags: []
metrics:
  - raw_payloads_stored_total
contracts_consumed: []
---

# Block 029 — Raw payload storage

## 1. Purpose

Persist `RawPayload[]` from connector pulls to Postgres for downstream
normalization (Phase 1D). Deduplicates by `(tenantId, connectorName, externalId)`.

## 2. Dependencies

- Block 025 — `RawPayload` type.
- Block 026 — `erp_connections` (FK reference for tenant_id validation).

## 3. Scope

### Migration `0008_integrations_raw_payloads.sql`

```sql
CREATE TABLE raw_payloads (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT NOT NULL,
  connector_name TEXT NOT NULL,
  entity_type    TEXT NOT NULL,
  external_id    TEXT NOT NULL,
  raw            JSONB NOT NULL,
  pulled_at      TIMESTAMPTZ NOT NULL,
  normalized_at  TIMESTAMPTZ,
  UNIQUE (tenant_id, connector_name, external_id)
);
CREATE INDEX raw_payloads_tenant_idx ON raw_payloads (tenant_id, connector_name, entity_type);
```

### `packages/integrations/src/storage.ts`

- `storePayloads(payloads, db): Promise<void>` — upserts on
  `(tenant_id, connector_name, external_id)`, updates `raw` and `pulled_at`.
- `getPendingPayloads(tenantId, connectorName, db): Promise<RawPayload[]>` —
  returns payloads where `normalized_at IS NULL`.
- `markNormalized(ids, db): Promise<void>`.

### `packages/integrations/__tests__/storage.test.ts`

- `storePayloads` upserts correctly (no duplicate on re-run).
- `getPendingPayloads` only returns un-normalized rows.
- `markNormalized` sets `normalized_at`.

## 4. Validation

- `pnpm --filter @saas/integrations typecheck` passes.
- `pnpm --filter @saas/integrations lint` passes.
- `pnpm --filter @saas/integrations test` passes.

## 5. Tenant safety

- [x] All queries filter by `tenant_id` — no cross-tenant payload access.
