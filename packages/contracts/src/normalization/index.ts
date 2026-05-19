import type { TenantId } from '../tenancy/types';

/**
 * INVARIANT: Wire-format edge between an ERP's bespoke response shape and
 * the canonical model.
 *
 * `RawPayload` is intentionally `unknown`-valued — the connector's
 * `ErpMapper.map` implementation is the sole boundary at which raw
 * values are narrowed and projected into branded canonical entities
 * (TS3, Q2). Code that reads from `RawPayload` outside a mapper is a
 * D-axiom violation: that data has not yet crossed the canonical boundary.
 */
export type RawPayload = Record<string, unknown>;

/**
 * INVARIANT: Normalized order status across all ERP connectors.
 *
 * Phase 1D vocabulary models the Brazilian retail / wholesale flow
 * (D-1D.4, D-0.7 — CISSPoder): `pending → confirmed → fulfilled` plus
 * the two terminal off-paths `cancelled` and `refunded`. Mappers
 * translate connector-specific status codes into this set.
 *
 * Widening the union is an additive contract change (D2) — consumers
 * using exhaustive `switch` adopt the new tag in their next block.
 */
export type CanonicalOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'fulfilled'
  | 'cancelled'
  | 'refunded';

/**
 * INVARIANT: Canonical product entity — the shape every ERP product /
 * SKU row is mapped into before persistence (Block 032) or analytics.
 *
 * Storage queries partition by `tenantId` (T1, DB3); the natural upsert
 * key is `(connectorName, externalId)` per D-1D.2. `extensions` carries
 * connector-specific extras that did not fit the canonical shape
 * (D-1D.3); it is `{}` when empty, never `null`.
 */
export interface CanonicalProduct {
  readonly tenantId: TenantId;
  readonly externalId: string;
  readonly connectorName: string;
  readonly sku: string;
  readonly name: string;
  readonly priceAmount: number;
  readonly priceCurrency: string;
  readonly extensions: Record<string, unknown>;
  readonly syncedAt: Date;
}

/**
 * INVARIANT: Canonical customer entity.
 *
 * `email` and `phone` are optional because many ERPs leave them blank
 * on B2B accounts (D-1D.2); when omitted, the property key is absent
 * (under `exactOptionalPropertyTypes`), never present-with-undefined.
 * `extensions` follows the same `{}`-when-empty rule as
 * {@link CanonicalProduct}.
 */
export interface CanonicalCustomer {
  readonly tenantId: TenantId;
  readonly externalId: string;
  readonly connectorName: string;
  readonly name: string;
  readonly email?: string;
  readonly phone?: string;
  readonly extensions: Record<string, unknown>;
  readonly syncedAt: Date;
}

/**
 * INVARIANT: Canonical order entity — the transactional fact row.
 *
 * `customerId` references {@link CanonicalCustomer.externalId} within the
 * same `(tenantId, connectorName)` scope; the storage layer (Block 032)
 * may enforce a foreign key, but the contract carries it as a plain
 * string to keep the canonical layer free of cross-table coupling.
 * `totalAmount` is JS `number` per D-1D.6 — sub-cent precision is not
 * a Phase 1D requirement.
 */
export interface CanonicalOrder {
  readonly tenantId: TenantId;
  readonly externalId: string;
  readonly connectorName: string;
  readonly customerId: string;
  readonly totalAmount: number;
  readonly currency: string;
  readonly status: CanonicalOrderStatus;
  readonly issuedAt: Date;
  readonly extensions: Record<string, unknown>;
  readonly syncedAt: Date;
}
