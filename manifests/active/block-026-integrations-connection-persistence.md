---
id: block-026-integrations-connection-persistence
tier: M
kind: implementation
phase: Phase 1C — Integrations
scope: phase-bound
status: Complete
domain: packages/integrations
risk: medium
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-018-tenancy-tenant-table
  - block-025-integrations-connector-interface
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/DATABASE.md
    - packages/integrations/src/index.ts
    - packages/tenancy/src/repository.ts
    - decisions/ADR-0002-postgres-orm.md
  modify:
    - packages/integrations/src/index.ts
  create:
    - infrastructure/db/migrations/0007_integrations_connections.sql
    - packages/integrations/src/connection.ts
    - packages/integrations/__tests__/connection.test.ts
benchmarks: []
flags: []
metrics:
  - connections_active_total
contracts_consumed:
  - packages/contracts/src/tenancy/types.ts
---

# Block 026 — Connection persistence

## 1. Purpose

Store ERP connection configs (credentials, baseUrl) per tenant in Postgres
so connectors can be initialized from DB at runtime.

## 2. Dependencies

- Block 018 — `tenants` table (FK target).
- Block 025 — `ConnectorConfig` interface.

## 3. Scope

### Migration `0007_integrations_connections.sql`

```sql
CREATE TABLE erp_connections (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  connector_name TEXT NOT NULL,
  credentials    JSONB NOT NULL,
  base_url       TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_name)
);
```

### `packages/integrations/src/connection.ts`

- `saveConnection(tenantId, config, db): Promise<void>`.
- `getConnection(tenantId, connectorName, db): Promise<ConnectorConfig | null>`.
- `deactivateConnection(tenantId, connectorName, db): Promise<void>`.

### `packages/integrations/__tests__/connection.test.ts`

- `saveConnection` + `getConnection` round-trip.
- `getConnection` returns null for unknown connector.
- `deactivateConnection` sets `active = false`.

## 4. Validation

- `pnpm --filter @saas/integrations typecheck` passes.
- `pnpm --filter @saas/integrations lint` passes.
- `pnpm --filter @saas/integrations test` passes.

## 5. Tenant safety

- [x] All queries scoped by `tenant_id`.
- [x] Credentials stored as JSONB — never logged.
