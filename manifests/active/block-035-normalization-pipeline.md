---
id: block-035-normalization-pipeline
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
  - block-032-normalization-canonical-tables
  - block-033-normalization-mapping-framework
  - block-034-normalization-cisspoder-mapper
  - block-029-integrations-payload-storage
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/DATABASE.md
    - packages/normalization/src/mapper.ts
    - packages/normalization/src/repository.ts
    - packages/integrations/src/storage.ts
    - packages/observability/src/index.ts
  modify:
    - packages/normalization/src/index.ts
  create:
    - packages/normalization/src/pipeline.ts
    - packages/normalization/__tests__/pipeline.test.ts
benchmarks: []
flags: []
metrics:
  - normalization_pipeline_run_total
  - normalization_pipeline_duration_seconds
  - normalization_pipeline_errors_total
  - normalization_entities_persisted_total
contracts_consumed:
  - packages/contracts/src/normalization/index.ts
---

# Block 035 — Normalization pipeline

## 1. Purpose

Orchestrate the full normalization flow: read pending `RawPayload[]` from
Block 029 storage, map to canonical entities via Block 033/034 mappers,
validate, upsert into Block 032 tables, and mark payloads as normalized.

## 2. Dependencies

- Block 029 — `getPendingPayloads`, `markNormalized`.
- Block 031 — canonical entity types.
- Block 032 — `upsertProduct`, `upsertCustomer`, `upsertOrder`.
- Block 033 — `MapperRegistry`.
- Block 034 — `registerCisspodorMappers`.

## 3. Scope

### `packages/normalization/src/pipeline.ts`

```ts
export interface NormalizationPipelineOptions {
  tenantId: string;
  connectorName: string;
  registry: MapperRegistry;
  db: DrizzleDb;
}

/**
 * Fetches all pending raw payloads for the given tenant + connector,
 * maps them to canonical entities, upserts them, and marks them normalized.
 * Returns the count of entities persisted.
 */
export async function runNormalizationPipeline(
  opts: NormalizationPipelineOptions
): Promise<{ persisted: number; skipped: number; errors: number }>;
```

Pipeline steps:
1. `getPendingPayloads(tenantId, connectorName, db)` — raw payloads.
2. For each payload: `registry.mapPayload(payload)`.
   - If `null` (no mapper registered): count as `skipped`.
3. Validate canonical entity: required fields present, numeric fields in
   range, `tenantId` matches payload's `tenantId`.
   - Validation failure: log error, count as `errors`, continue (do not throw).
4. `upsertProduct / upsertCustomer / upsertOrder` based on entity type.
5. Collect IDs of successfully processed payloads.
6. `markNormalized(ids, db)` — batch update.
7. Emit metrics: `normalization_entities_persisted_total += persisted`.

Error isolation: one payload failure must not stop others (same pattern as
the Pull Scheduler in Block 028).

### `packages/normalization/__tests__/pipeline.test.ts`

- Full happy-path: 3 pending payloads → 3 upserts → `markNormalized` called
  with all 3 IDs.
- Unknown `entityType` → payload counted as `skipped`, not `errors`.
- Validation failure (missing required field) → counted as `errors`,
  remaining payloads still processed.
- `markNormalized` is called only with successfully persisted IDs.

## 4. Validation

- `pnpm --filter @saas/normalization typecheck` passes.
- `pnpm --filter @saas/normalization lint` passes.
- `pnpm --filter @saas/normalization test` passes.

## 5. Tenant safety

- [x] `getPendingPayloads` is always called with the invoking tenant's ID.
- [x] Canonical entity's `tenantId` is validated against payload's `tenantId`
  before upsert — prevents mapper bugs from crossing tenant boundaries.
