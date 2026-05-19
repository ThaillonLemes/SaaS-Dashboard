import type { CanonicalOrder, CanonicalOrderStatus } from '@saas/contracts';

import {
  requireDate,
  requireFiniteNumber,
  requireObject,
  requireString,
} from '../internal/asserts';

export type { CanonicalOrder, CanonicalOrderStatus } from '@saas/contracts';

const ENTITY_NAME = 'CanonicalOrder';

// WHY: mirrors the union in `@saas/contracts/normalization` so `validate`
// can reject statuses produced by code that bypassed the type system
// (e.g. JSON deserialization). Widening the contract union requires
// updating this set in the same block (D2).
const VALID_STATUSES: ReadonlySet<CanonicalOrderStatus> = new Set<CanonicalOrderStatus>([
  'pending',
  'confirmed',
  'fulfilled',
  'cancelled',
  'refunded',
]);

/**
 * Reject a {@link CanonicalOrder} missing or invalid on any required
 * field. `status` is checked against the canonical vocabulary
 * (D-1D.4) as a runtime guard against bypassed-type-system input.
 *
 * @throws {Error} with message `'CanonicalOrder.<field>: <reason>'`.
 */
export function validate(order: CanonicalOrder): void {
  requireString(order.tenantId, ENTITY_NAME, 'tenantId');
  requireString(order.externalId, ENTITY_NAME, 'externalId');
  requireString(order.connectorName, ENTITY_NAME, 'connectorName');
  requireString(order.customerId, ENTITY_NAME, 'customerId');
  requireFiniteNumber(order.totalAmount, ENTITY_NAME, 'totalAmount');
  requireString(order.currency, ENTITY_NAME, 'currency');
  if (!VALID_STATUSES.has(order.status)) {
    throw new Error(
      `${ENTITY_NAME}.status: '${String(order.status)}' is not a canonical status`,
    );
  }
  requireDate(order.issuedAt, ENTITY_NAME, 'issuedAt');
  requireObject(order.extensions, ENTITY_NAME, 'extensions');
  requireDate(order.syncedAt, ENTITY_NAME, 'syncedAt');
}
