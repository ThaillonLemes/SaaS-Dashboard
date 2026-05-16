---
id: block-025-integrations-connector-interface
tier: M
kind: implementation
phase: Phase 1C — Integrations
scope: phase-bound
status: Pending
domain: packages/integrations
risk: medium
performance_critical: false
created_at: 2026-05-16
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
  - block-004-contracts-skeleton
parallel_with:
  - block-011-identity-password-auth
  - block-018-tenancy-tenant-table
  - block-031-normalization-canonical-model
  - block-037-ui-kit-design-tokens
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/API.md
    - packages/contracts/src/index.ts
    - decisions/ADR-0001-monorepo.md
  modify: []
  create:
    - packages/integrations/package.json
    - packages/integrations/tsconfig.json
    - packages/integrations/README.md
    - packages/integrations/src/index.ts
    - packages/integrations/src/connector.ts
    - packages/integrations/src/errors.ts
    - packages/integrations/__tests__/connector.test.ts
benchmarks: []
flags: []
metrics:
  - connector_pull_total
  - connector_pull_duration_seconds
  - connector_pull_errors_total
contracts_consumed: []
---

# Block 025 — Connector interface + base class

## 1. Purpose

Bootstrap `packages/integrations` and define the `ErpConnector` interface
that every ERP adapter (CISSPoder in Block 027, others later) implements.

## 2. Dependencies

- Block 001 — workspace tooling (tsconfig, eslint).
- Block 004 — contracts (TenantId for scoping pulls).

## 3. Scope

### `packages/integrations/src/connector.ts`

```ts
export interface ErpConnector {
  readonly name: string;
  readonly version: string;
  connect(config: ConnectorConfig): Promise<void>;
  pull(tenantId: TenantId, since?: Date): Promise<RawPayload[]>;
  disconnect(): Promise<void>;
}

export interface ConnectorConfig {
  readonly tenantId: TenantId;
  readonly credentials: Record<string, string>;
  readonly baseUrl?: string;
}

export interface RawPayload {
  readonly connectorName: string;
  readonly tenantId: TenantId;
  readonly entityType: string;
  readonly externalId: string;
  readonly pulledAt: Date;
  readonly raw: unknown;
}
```

### `packages/integrations/src/errors.ts`

`IntegrationError` class with codes: `CONNECTION_FAILED`, `AUTH_FAILED`, `PULL_FAILED`, `RATE_LIMITED`.

### Public surface (`src/index.ts`)

Exports: `ErpConnector`, `ConnectorConfig`, `RawPayload`, `IntegrationError`.

## 4. Validation

- `pnpm --filter @saas/integrations typecheck` passes.
- `pnpm --filter @saas/integrations lint` passes.
- `pnpm --filter @saas/integrations test` passes:
  - A `MockConnector` implementing `ErpConnector` compiles without type errors.
  - `IntegrationError` instances have the correct `code`.

## 5. Tenant safety check

- [x] `RawPayload` carries `tenantId` — storage layer (Block 029) partitions by it.
- [x] `pull(tenantId)` — connector implementations must scope requests to the tenant's credentials only.

## 6. Out of scope

- Connection persistence table (Block 026).
- First ERP connector implementation (Block 027 — CISSPoder).
- Pull scheduler (Block 028).
- Raw payload storage (Block 029).
