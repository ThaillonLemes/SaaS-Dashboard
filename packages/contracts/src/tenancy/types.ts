import type { UserId } from '../identity/types';

import type { Plan } from './plan';

/**
 * INVARIANT: Branded primary key for `packages/tenancy`.
 *
 * Primary key for tenant-scoped data and the RLS predicate
 * `tenant_id = current_setting('app.tenant_id')` (T1, protocols/DATABASE.md).
 * Constructed by the tenancy-package resolver — never coerced from a raw
 * string inside the system.
 */
export type TenantId = string & { readonly __brand: 'TenantId' };

/**
 * INVARIANT: Tenant-scoped role.
 *
 * Foundation enumerates four roles in descending privilege order:
 * owner > admin > member > viewer. Phase 1B Block 020 may extend this
 * additively into a richer RBAC contract; consumers depend on the union,
 * not on the tag count.
 */
export type Role = 'owner' | 'admin' | 'member' | 'viewer';

/**
 * INVARIANT: Single source of truth for "who is acting on which tenant
 * in this request" (T1, protocols/TENANT.md).
 *
 * Issued exclusively by `getTenantContext` in `packages/tenancy`, which
 * verifies user-tenant membership before returning. Every domain
 * operation accepts this as its first argument (or operates inside a
 * transaction already scoped via `SET LOCAL app.tenant_id`). A function
 * that does not accept `TenantContext` is a leaf utility, a cross-tenant
 * operation (which accepts {@link AdminContext}), or a bug.
 */
export interface TenantContext {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly roles: ReadonlyArray<Role>;
  readonly plan: Plan;
}

/**
 * INVARIANT: Privileged cross-tenant operation context (T-2,
 * protocols/TENANT.md).
 *
 * Issued only by system processes or support tooling with explicit user
 * action and reason capture. Every issuance writes to the audit log
 * (`auditId` is the audit-row primary key). NEVER substitute this for
 * {@link TenantContext} — the type distinction is what enforces the
 * tenant-safety boundary at the type system.
 */
export interface AdminContext {
  readonly userId: UserId;
  readonly reason: string;
  readonly auditId: string;
}
