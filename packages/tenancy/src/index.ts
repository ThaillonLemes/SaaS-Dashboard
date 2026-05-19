import type {
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
 * returns a rejected promise carrying a {@link TenancyError} with
 * code `'NOT_IMPLEMENTED'` so skeleton-time consumers can wire the
 * type without depending on a fake.
 *
 * @throws {TenancyError} via the returned promise, with code
 *   `'NOT_IMPLEMENTED'`.
 */
export function getTenantContext(
  userId: UserId,
  tenantId: TenantId,
): Promise<TenantContext> {
  return Promise.reject(
    new TenancyError(
      'NOT_IMPLEMENTED',
      `getTenantContext(${userId}, ${tenantId}) — Phase 1B block-019`,
    ),
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
  ctx: TenantContext,
  requiredRole: Role,
): void {
  throw new TenancyError(
    'NOT_IMPLEMENTED',
    `enforceRole(tenant=${ctx.tenantId}, requiredRole=${requiredRole}) — Phase 1B block-020`,
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
  ctx: TenantContext,
  resource: ResourceKind,
  currentValue: number,
): void {
  throw new TenancyError(
    'NOT_IMPLEMENTED',
    `enforcePlanLimit(tenant=${ctx.tenantId}, resource=${resource}, currentValue=${String(currentValue)}) — Phase 1B block-021`,
  );
}

export {
  createTenant,
  getTenantById,
  getTenantBySlug,
  softDeleteTenant,
} from './repository';
export type { DrizzleDb } from './repository';
export { tenants } from './schema';
export { TenancyError } from './types';
export type { ResourceKind } from './types';

export type { NewTenant, Plan, Role, Tenant, TenantContext } from '@saas/contracts';
