---
id: block-028-integrations-pull-scheduler
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
  - block-027-integrations-cisspoder-connector
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - packages/integrations/src/connector.ts
    - packages/integrations/src/connection.ts
    - packages/observability/src/index.ts
  modify:
    - packages/integrations/src/index.ts
  create:
    - packages/integrations/src/scheduler.ts
    - packages/integrations/__tests__/scheduler.test.ts
benchmarks: []
flags: []
metrics:
  - scheduler_run_total
  - scheduler_run_duration_seconds
  - scheduler_run_errors_total
contracts_consumed: []
---

# Block 028 — Pull scheduler

## 1. Purpose

A scheduler that iterates all active connections and calls `connector.pull()`
for each tenant on a configurable interval. Runs as a background loop in `apps/api`.

## 2. Dependencies

- Block 025 — `ErpConnector` interface.
- Block 026 — `getConnection`, `erp_connections` table.
- Block 027 — `CisspodorConnector` as the registered connector.

## 3. Scope

### `packages/integrations/src/scheduler.ts`

```ts
export class PullScheduler {
  constructor(private connectors: Map<string, ErpConnector>, private db: DrizzleDb) {}
  async runOnce(): Promise<void>;   // pull all active connections
  start(intervalMs: number): void;  // setInterval wrapper
  stop(): void;
}
```

- `runOnce` loads all `active = true` connections from DB, finds matching
  connector by `connectorName`, calls `pull(tenantId)`, stores raw payloads
  (calls Block 029's `storePayloads` — stub if 029 not done yet).
- Logs via `@saas/observability`. Errors per-tenant are caught and logged —
  one tenant's failure does not stop others.

### `packages/integrations/__tests__/scheduler.test.ts`

- `runOnce` calls `pull` for each active connection.
- Per-tenant error is caught and logged, not thrown.
- `stop` prevents further runs.

## 4. Validation

- `pnpm --filter @saas/integrations typecheck` passes.
- `pnpm --filter @saas/integrations lint` passes.
- `pnpm --filter @saas/integrations test` passes.

## 5. Tenant safety

- [x] Each pull is isolated to its tenant's connection — no cross-tenant data mixing.
