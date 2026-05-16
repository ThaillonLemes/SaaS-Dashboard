---
id: block-006-tenancy-skeleton
tier: M
kind: implementation
phase: Phase 0 — Foundation
scope: phase-bound
status: Pending
domain: packages/tenancy
risk: low
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
  - block-004-contracts-skeleton
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/TENANT.md
    - DOMAIN_ARCHITECTURE.md
    - AGENT_OPERATING_MODEL.md
    - decisions/ADR-0005-billing.md
    - templates/domain-doc.md
    - packages/contracts/src/tenancy/types.ts
    - packages/contracts/src/tenancy/plan.ts
  modify: []
  create:
    - packages/tenancy/package.json
    - packages/tenancy/tsconfig.json
    - packages/tenancy/README.md
    - packages/tenancy/STATE.md
    - packages/tenancy/src/index.ts
    - packages/tenancy/src/types.ts
    - packages/tenancy/__tests__/skeleton.test.ts
benchmarks: []
flags: []
metrics: []
contracts_consumed:
  - "@saas/contracts/tenancy/TenantId"
  - "@saas/contracts/tenancy/TenantContext"
  - "@saas/contracts/tenancy/Plan"
  - "@saas/contracts/tenancy/PlanLimit"
  - "@saas/contracts/tenancy/Role"
  - "@saas/contracts/identity/UserId"
contracts_published: []
---

# Block 006 — `packages/tenancy` skeleton

## 1. Purpose

Land the scaffolding for the tenancy domain. Publish the
**public-surface signatures** that every Phase 1+ consumer will depend
on: `getTenantContext`, `enforceRole`, `enforcePlanLimit`. Stub bodies
throw `TenancyError` with code `NOT_IMPLEMENTED`. Phase 1B Blocks
018-024 fill in the real implementation.

## 2. Dependencies

- Block 001 (workspace).
- Block 004 (contracts must export `TenantId`, `TenantContext`, `Plan`,
  `PlanLimit`, `Role`).

## 3. Public surface (`packages/tenancy/src/index.ts`)

```ts
import type {
  TenantContext,
  TenantId,
  Plan,
  Role,
} from '@saas/contracts';
import type { UserId } from '@saas/contracts';

export class TenancyError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

export type ResourceKind =
  | 'rowsPerMonth'
  | 'maxDashboards'
  | 'maxKpis'
  | 'maxErpConnections'
  | 'maxSeats';

// Phase 1B Block 019 fills in
export async function getTenantContext(
  _userId: UserId,
  _tenantId: TenantId,
): Promise<TenantContext> {
  throw new TenancyError('NOT_IMPLEMENTED', 'getTenantContext() — Phase 1B block-019');
}

// Phase 1B Block 020 fills in
export function enforceRole(_ctx: TenantContext, _requiredRole: Role): void {
  throw new TenancyError('NOT_IMPLEMENTED', 'enforceRole() — Phase 1B block-020');
}

// Phase 1B Block 021 fills in (per ADR-0005)
export function enforcePlanLimit(_ctx: TenantContext, _resource: ResourceKind, _currentValue: number): void {
  throw new TenancyError('NOT_IMPLEMENTED', 'enforcePlanLimit() — Phase 1B block-021');
}

export type { TenantContext, Plan, Role };  // re-export for ergonomics
```

## 4. Types (`src/types.ts`)

Domain-internal types: `TenancyError`, `ResourceKind`. Cross-domain types
stay in `@saas/contracts`.

## 5. README + STATE

- `README.md` per `templates/domain-doc.md`. Identity, ownership scope,
  public surface, the three enforcement gates, dependencies.
- `STATE.md` records "skeleton; Phase 1B Block 018-024 fills in real
  enforcement."

## 6. Tests (`__tests__/skeleton.test.ts`)

- `getTenantContext()` throws `TenancyError('NOT_IMPLEMENTED')`.
- `enforceRole()` throws `TenancyError('NOT_IMPLEMENTED')`.
- `enforcePlanLimit()` throws `TenancyError('NOT_IMPLEMENTED')`.
- Types compile against `@saas/contracts` (no `any` leak).
- Re-exported `TenantContext` is the same type as `@saas/contracts`'s
  `TenantContext` (assertion).

## 7. Validation

- `pnpm --filter @saas/tenancy typecheck` passes.
- `pnpm --filter @saas/tenancy lint` passes.
- `pnpm --filter @saas/tenancy test` passes.
- Package depends only on `@saas/contracts` and `@saas/observability` (the
  latter optional in skeleton — added when Phase 1B implements logging).
- ESLint D1 enforcement: no deep imports.

## 8. Rollback signals

- Type leakage of an internal type.
- Stub function returns a real value instead of throwing.

## 9. Expected outcomes

After integration:
- Phase 1A's `apps/api` middleware (Phase 1A Block 013) can wire
  `validateSession` (identity) + `getTenantContext` (tenancy) into
  request context.
- Phase 1B implementations slot into the existing signatures with no
  breaking change.
- The Tenancy Agent (per
  [AGENT_OPERATING_MODEL.md:22](../../AGENT_OPERATING_MODEL.md:22)) is
  the sole writer to this package going forward.

## 10. Tenant safety check

- [x] No tables created (Phase 1B Block 018 lands `tenants`,
      `tenant_memberships`, `roles`).
- [x] No repository methods.
- [x] No HTTP endpoints.
- [x] Stub functions don't operate on data.

## 11. Cross-domain check

- [x] No deep imports across packages (D1) — imports only the
      `@saas/contracts` public surface.
- [x] Cross-domain types live in `packages/contracts/` (D2) — Block 004
      already shipped them.
- [x] No utility duplication (C3) — first tenancy implementation.

## 12. Risks

- **Risk:** `enforcePlanLimit` signature shape might need refinement when Phase 1B implements real billing checks (e.g., async DB read for cap). **Mitigation:** Skeleton accepts a `currentValue: number` argument so the caller does the read; if Phase 1B prefers `Promise<void>` for async lookups, that's an additive contract change (return type changes from `void` to `Promise<void>`).
- **Risk:** Role enum is too simple. **Mitigation:** Block 004 shipped it as an opaque enum; Phase 1B Block 020 can expand to RBAC permissions without breaking the foundation.

## 13. Out of scope

- Real tenant creation (Phase 1B Block 018).
- Real role enforcement (Phase 1B Block 020).
- Real plan-limit caps (Phase 1B Block 021).
- Tenant CRUD API (Phase 1B Block 022).
- Onboarding UI (Phase 1B Block 023).

## 14. New abstraction

None. Stub functions + error class + `ResourceKind` literal type —
standard idioms.
