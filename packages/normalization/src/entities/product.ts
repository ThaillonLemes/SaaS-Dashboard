import type { CanonicalProduct } from '@saas/contracts';

import {
  requireDate,
  requireFiniteNumber,
  requireObject,
  requireString,
} from '../internal/asserts';

export type { CanonicalProduct } from '@saas/contracts';

const ENTITY_NAME = 'CanonicalProduct';

/**
 * Reject a {@link CanonicalProduct} missing or invalid on any required
 * field. Used at the post-map / pre-persist boundary; consumers inside
 * the system trust the type and do not re-validate.
 *
 * @throws {Error} with message `'CanonicalProduct.<field>: <reason>'`.
 */
export function validate(product: CanonicalProduct): void {
  requireString(product.tenantId, ENTITY_NAME, 'tenantId');
  requireString(product.externalId, ENTITY_NAME, 'externalId');
  requireString(product.connectorName, ENTITY_NAME, 'connectorName');
  requireString(product.sku, ENTITY_NAME, 'sku');
  requireString(product.name, ENTITY_NAME, 'name');
  requireFiniteNumber(product.priceAmount, ENTITY_NAME, 'priceAmount');
  requireString(product.priceCurrency, ENTITY_NAME, 'priceCurrency');
  requireObject(product.extensions, ENTITY_NAME, 'extensions');
  requireDate(product.syncedAt, ENTITY_NAME, 'syncedAt');
}
