import type { RawPayload, TenantId } from '@saas/contracts';

/**
 * INVARIANT: Mapping contract from a connector's raw response item to a
 * canonical entity (Phase 1D, D-1D.5).
 *
 * One `ErpMapper<T>` instance per (connector, canonical-entity) pair.
 * The implementation is responsible for:
 *
 *   1. Narrowing fields of the untyped {@link RawPayload} to the
 *      connector's expected shape.
 *   2. Stamping the canonical fields (`tenantId`, `connectorName`,
 *      `syncedAt`).
 *   3. Folding ERP-specific extras into `extensions` (D-1D.3).
 *
 * Per TS3 / Q2, the mapper IS the boundary at which raw input becomes
 * a typed canonical instance — defensive re-validation inside the
 * system is forbidden. A mapper that cannot produce a canonical row
 * throws; the mapping framework (Block 033) catches at the per-row
 * boundary so one bad row does not poison a batch.
 */
export interface ErpMapper<T> {
  readonly connectorName: string;
  map(raw: RawPayload, tenantId: TenantId): T;
}
