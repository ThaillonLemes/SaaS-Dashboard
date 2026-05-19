---
id: block-027-integrations-cisspoder-connector
tier: M
kind: implementation
phase: Phase 1C — Integrations
scope: phase-bound
status: Pending
domain: packages/integrations
risk: high
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 2
dependencies:
  - block-025-integrations-connector-interface
  - block-026-integrations-connection-persistence
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - packages/integrations/src/connector.ts
    - packages/integrations/src/connection.ts
    - phases/phase-1c/decisions.md
  modify: []
  create:
    - phases/phase-1c/decisions.md
    - packages/integrations/src/connectors/cisspoder/index.ts
    - packages/integrations/src/connectors/cisspoder/client.ts
    - packages/integrations/src/connectors/cisspoder/mappers.ts
    - packages/integrations/__tests__/cisspoder.test.ts
benchmarks: []
flags: []
metrics:
  - cisspoder_pull_total
  - cisspoder_pull_duration_seconds
  - cisspoder_pull_errors_total
contracts_consumed:
  - packages/contracts/src/tenancy/types.ts
---

# Block 027 — CISSPoder connector

## 1. Purpose

Implement the first real `ErpConnector` for CISSPoder. Pulls products,
customers, and orders via the CISSPoder REST API and returns `RawPayload[]`.

## 2. Dependencies

- Block 025 — `ErpConnector` interface.
- Block 026 — `getConnection` to load credentials from DB.

## 3. Scope

### `phases/phase-1c/decisions.md`

Document CISSPoder API specifics: base URL, auth method (API key header),
rate limits, pagination strategy, entity endpoints.

### `packages/integrations/src/connectors/cisspoder/client.ts`

HTTP client wrapper for CISSPoder API. Handles auth header, pagination,
retries on 429 (rate limited), and throws `IntegrationError` on failures.

### `packages/integrations/src/connectors/cisspoder/mappers.ts`

Functions mapping CISSPoder response shapes to `RawPayload`:
- `mapProduct(raw, tenantId): RawPayload`
- `mapCustomer(raw, tenantId): RawPayload`
- `mapOrder(raw, tenantId): RawPayload`

### `packages/integrations/src/connectors/cisspoder/index.ts`

`Cisspoder` class implementing `ErpConnector`:
- `connect(config)` — validates credentials against the API.
- `pull(tenantId, since?)` — fetches products/customers/orders since last pull.
- `disconnect()` — no-op (stateless HTTP).

### `packages/integrations/__tests__/cisspoder.test.ts`

Use `nock` or `msw` to mock CISSPoder API responses:
- `pull` returns correct `RawPayload[]` shape.
- Auth failure throws `IntegrationError` code `AUTH_FAILED`.
- Rate limit response triggers retry then throws `RATE_LIMITED`.

## 4. Validation

- `pnpm --filter @saas/integrations typecheck` passes.
- `pnpm --filter @saas/integrations lint` passes.
- `pnpm --filter @saas/integrations test` passes (mocked API).

## 5. Tenant safety

- [x] Credentials loaded per-tenant from DB — never shared across tenants.
- [x] `RawPayload.tenantId` always set from the requesting tenant.
