import type { CanonicalCustomer } from '@saas/contracts';

import {
  requireDate,
  requireObject,
  requireString,
} from '../internal/asserts';

export type { CanonicalCustomer } from '@saas/contracts';

const ENTITY_NAME = 'CanonicalCustomer';

/**
 * Reject a {@link CanonicalCustomer} missing or invalid on any required
 * field. `email` and `phone` are validated only when present — under
 * `exactOptionalPropertyTypes`, an absent optional property is distinct
 * from one set to `undefined`, so the `!== undefined` guard suffices.
 *
 * @throws {Error} with message `'CanonicalCustomer.<field>: <reason>'`.
 */
export function validate(customer: CanonicalCustomer): void {
  requireString(customer.tenantId, ENTITY_NAME, 'tenantId');
  requireString(customer.externalId, ENTITY_NAME, 'externalId');
  requireString(customer.connectorName, ENTITY_NAME, 'connectorName');
  requireString(customer.name, ENTITY_NAME, 'name');
  requireObject(customer.extensions, ENTITY_NAME, 'extensions');
  requireDate(customer.syncedAt, ENTITY_NAME, 'syncedAt');
  if (customer.email !== undefined) {
    requireString(customer.email, ENTITY_NAME, 'email');
  }
  if (customer.phone !== undefined) {
    requireString(customer.phone, ENTITY_NAME, 'phone');
  }
}
