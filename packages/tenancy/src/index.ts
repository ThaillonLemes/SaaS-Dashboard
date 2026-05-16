import type {
  Plan,
  Role,
  TenantContext,
  TenantId,
  UserId,
} from '@saas/contracts';

import { TenancyError, type ResourceKind } from './types';

/**
 * Resolve a {@link TenantContext} for a `(userId, tenantId)` pair.
 *
 * INVARIANT: This is the sole constructor for `TenantContext`
 * (T1, protocols/TENANT.md). Phase 1B Block 019 fills in membership
 * lookup, role projection, and plan attachment; until then every call
 * throws {@link TenancyError} with code `'NOT_IMPLEMENTED'` so
 * skeleton-time consumers can wire the type without depending on a
 * fake.
 *
 * @throws {TenancyError} always, with code `'NOT_IMPLEMENTED'`.
 */
export async function getTenantContext(
  _userId: UserId,
  _tenantId: TenantId,
): Promise<TenantContext> {
  throw new TenancyError(
    'NOT_IMPLEMENTED',
    'getTenantContext() — Phase 1B block-019',
  );
}

/**
 * Assert that the actor in `ctx` holds at least `requiredRole`.
 *
 * INVARIANT: Throwing-style gate (TS4 Style B) chosen because every
 * call site is a guard preceding the protected operation; a `Result`
 * return would force `if (!ok) throw` at every call. Phase 1B Block
 * 020 fills in the role-hierarchy comparison.
 *
 * @throws {TenancyError} always, with code `'NOT_IMPLEMENTED'`.
 */
export function enforceRole(
  _ctx: TenantContext,
  _requiredRole: Role,
): void {
  throw new TenancyError(
    'NOT_IMPLEMENTED',
    'enforceRole() — Phase 1B block-020',
  );
}

/**
 * Assert that the tenant in `ctx` has remaining capacity for `resource`
 * given `currentValue` already consumed.
 *
 * INVARIANT: Hard-cap enforcement per ADR-0005 — no metered overage.
 * The caller computes `currentValue` (typically a `COUNT(*)` or
 * month-to-date aggregate) so this function stays synchronous and
 * pure; if Phase 1B Block 021 needs to read the count itself, the
 * return type widens additively from `void` to `Promise<void>`
 * (P5 — consumers depend on the interface shape, not the return).
 *
 * @throws {TenancyError} always, with code `'NOT_IMPLEMENTED'`.
 */
export function enforcePlanLimit(
  _ctx: TenantContext,
  _resource: ResourceKind,
  _currentValue: number,
): void {
  throw new TenancyError(
    'NOT_IMPLEMENTED',
    'enforcePlanLimit() — Phase 1B block-021',
  );
}

export { TenancyError } from './types';
export type { ResourceKind } from './types';

export type { Plan, Role, TenantContext } from '@saas/contracts';
