# `packages/tenancy` — local state

_Last updated: 2026-05-16 (Block 006 skeleton in flight)._

---

## Current block

**Block 006 — `packages/tenancy` skeleton** ([manifest](../../manifests/active/block-006-tenancy-skeleton.md)).

Scaffolds the package: `package.json`, `tsconfig.json`, README, this
file, public surface (`src/index.ts`), internal types
(`src/types.ts`), skeleton test (`__tests__/skeleton.test.ts`).

The three gates — `getTenantContext`, `enforceRole`,
`enforcePlanLimit` — exist as exported signatures with bodies that
throw `TenancyError('NOT_IMPLEMENTED')`. Phase 1B Blocks 019 / 020 /
021 will fill them in additively.

---

## Public surface (frozen at this block)

```ts
export function getTenantContext(
  userId: UserId,
  tenantId: TenantId,
): Promise<TenantContext>;

export function enforceRole(
  ctx: TenantContext,
  requiredRole: Role,
): void;

export function enforcePlanLimit(
  ctx: TenantContext,
  resource: ResourceKind,
  currentValue: number,
): void;

export class TenancyError extends Error { readonly code: string }
export type ResourceKind =
  | 'rowsPerMonth' | 'maxDashboards' | 'maxKpis'
  | 'maxErpConnections' | 'maxSeats';
export type { Plan, Role, TenantContext };
```

P5 contract: consumers depend on these signatures, not on the bodies.
Phase 1B implementations may widen the return type of
`enforcePlanLimit` from `void` to `Promise<void>` (additive); other
signatures stay stable.

---

## What lands in Phase 1B

| Block | Surface change |
|-------|---------------|
| 018   | DB tables (`tenants`, `tenant_memberships`, `roles`) + RLS. |
| 019   | `getTenantContext` resolution against `tenant_memberships`. |
| 020   | `enforceRole` hierarchy + additive RBAC permission union. |
| 021   | `enforcePlanLimit` concrete ADR-0005 caps + Phase-3 billing hook. |
| 022   | Tenant CRUD HTTP endpoints (lives in `apps/api`). |
| 023   | Onboarding UI (lives in `apps/web`). |
| 024   | Tenant deletion (T-10). |

---

## Active risks

- `enforcePlanLimit` signature might need `Promise<void>` once Phase
  1B reads counts inside the gate. Mitigation: additive return-type
  widening — no caller breaks.
- `Role` is the foundation four (`owner`/`admin`/`member`/`viewer`).
  Block 020 may widen to a permission-tag union. Mitigation: union
  widening is non-breaking for existing consumers.

---

## Cross-domain status

See workspace [`STATE.md`](../../STATE.md). `identity` (Block 005) is
on a parallel-safe track; both must land before Phase 1A wires
`validateSession + getTenantContext` into the API request context.
