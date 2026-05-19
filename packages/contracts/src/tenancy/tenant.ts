import type { PlanTier } from './plan';
import type { TenantId } from './types';

/**
 * INVARIANT: The persisted `tenants` row shape — the cross-domain wire
 * format for tenant entities (per `infrastructure/db/migrations/
 * 0003_tenancy_tenants.sql`).
 *
 * `Tenant` is the entity exposed to consumers; `TenantContext` (in
 * `./types.ts`) is the per-request authorization handle. They are not
 * interchangeable: a `Tenant` describes WHO the tenant is, a
 * `TenantContext` describes who is acting WITHIN one.
 *
 * `deletedAt` is the soft-delete cursor (T-10, `protocols/TENANT.md`).
 * Repository queries in `packages/tenancy` exclude soft-deleted rows
 * by default; a non-null value means the tenant is in the audit-window
 * retention period before hard delete.
 */
export interface Tenant {
  readonly id: TenantId;
  readonly slug: string;
  readonly name: string;
  readonly planTier: PlanTier;
  readonly createdAt: Date;
  readonly deletedAt: Date | null;
}

/**
 * INVARIANT: Input shape for `createTenant` — the caller-supplied
 * subset of the persisted row.
 *
 * `id` is optional: when omitted, the database supplies
 * `gen_random_uuid()::text`; when present, the caller is responsible
 * for ID generation (used by deterministic seeding and cross-system
 * imports). `planTier` defaults to `'starter'` at the database level
 * and is therefore optional here. `createdAt` and `deletedAt` are
 * managed by the database / repository and never accepted on create.
 */
export interface NewTenant {
  readonly id?: TenantId;
  readonly slug: string;
  readonly name: string;
  readonly planTier?: PlanTier;
}
