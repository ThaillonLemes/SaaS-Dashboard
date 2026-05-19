---
id: block-033-normalization-mapping-framework
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
  - block-032-normalization-canonical-tables
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - packages/normalization/src/index.ts
    - packages/normalization/src/types.ts
  modify:
    - packages/normalization/src/index.ts
  create:
    - packages/normalization/src/mapper.ts
    - packages/normalization/__tests__/mapper.test.ts
benchmarks: []
flags: []
metrics: []
contracts_consumed:
  - packages/contracts/src/normalization/index.ts
---

# Block 033 — Mapping framework

## 1. Purpose

Provide a generic `EntityMapper` interface and `MapperRegistry` class that
connector-specific mappers (Block 034+) plug into. Decouples the pipeline
(Block 035) from any particular connector.

## 2. Dependencies

- Block 031 — `RawPayload`, `CanonicalProduct`, `CanonicalCustomer`,
  `CanonicalOrder` types.

## 3. Scope

### `packages/normalization/src/mapper.ts`

```ts
import type { RawPayload } from '@saas/contracts';
import type { CanonicalCustomer, CanonicalOrder, CanonicalProduct } from './types.js';

/** Union of all canonical entity shapes. */
export type CanonicalEntity = CanonicalProduct | CanonicalCustomer | CanonicalOrder;

/** One mapper handles a single (connectorName, entityType) pair. */
export interface EntityMapper {
  readonly connectorName: string;
  readonly entityType: string;
  map(payload: RawPayload): CanonicalEntity;
}

export class MapperRegistry {
  private readonly mappers = new Map<string, EntityMapper>();

  /** Key: `${connectorName}:${entityType}` */
  register(mapper: EntityMapper): void;

  /** Returns null if no mapper is registered for the pair. */
  getMapper(connectorName: string, entityType: string): EntityMapper | null;

  /**
   * Convenience: maps a single payload.
   * Returns null and logs a warning when no mapper is found.
   */
  mapPayload(payload: RawPayload): CanonicalEntity | null;
}
```

- `MapperRegistry` is instantiated once and injected into the pipeline.
- Duplicate registration (same key) throws `Error` at startup — no silent
  overwrites.

### `packages/normalization/__tests__/mapper.test.ts`

- `register` + `getMapper` round-trip for a stub mapper.
- `mapPayload` delegates to the correct mapper.
- `mapPayload` returns `null` for unknown `(connectorName, entityType)`.
- Duplicate `register` throws.

## 4. Validation

- `pnpm --filter @saas/normalization typecheck` passes.
- `pnpm --filter @saas/normalization lint` passes.
- `pnpm --filter @saas/normalization test` passes.

## 5. Tenant safety

- [x] `MapperRegistry` is stateless w.r.t. tenants — tenant isolation is
  enforced at the pipeline level (Block 035).
