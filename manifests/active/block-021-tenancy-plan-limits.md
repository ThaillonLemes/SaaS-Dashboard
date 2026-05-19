---
id: block-021-tenancy-plan-limits
tier: M
kind: implementation
phase: Phase 1B — Tenancy
scope: phase-bound
status: Pending
domain: packages/tenancy
risk: medium
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-019-tenancy-context-factory
  - block-020-tenancy-roles
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/TENANT.md
    - packages/tenancy/src/index.ts
    - packages/contracts/src/tenancy/plan.ts
    - decisions/ADR-0005-billing.md
  modify:
    - packages/tenancy/src/index.ts
  create:
    - packages/tenancy/src/limits.ts
    - packages/tenancy/__tests__/limits.test.ts
benchmarks: []
flags: []
metrics:
  - plan_limit_enforced_total
  - plan_limit_exceeded_total
contracts_consumed:
  - packages/contracts/src/tenancy/plan.ts
---

# Block 021 — Plan limits + enforcement

## 1. Purpose

Replace the `enforcePlanLimit` stub with a real check against the tenant's
`PlanLimit` values. Enforcement is synchronous — the limit is read from
the resolved `TenantContext`.

## 2. Dependencies

- Block 019 — `TenantContext` with `plan.limits` populated.
- Block 020 — role enforcement pattern to follow.

## 3. Scope

### `packages/tenancy/src/limits.ts`

- `enforcePlanLimit(ctx, resource, currentCount): void` — throws
  `TenancyError` code `PLAN_LIMIT_EXCEEDED` if `currentCount >= limit`.
- `getPlanLimits(tier): PlanLimits` — returns default limits per tier
  (starter / pro / enterprise).

### Update `getTenantContext`

Populate `ctx.plan.limits` from `getPlanLimits(tenant.planTier)`.

### `packages/tenancy/__tests__/limits.test.ts`

- `enforcePlanLimit` passes when under limit.
- `enforcePlanLimit` throws `PLAN_LIMIT_EXCEEDED` when at or over limit.
- Each plan tier has correct default limits.

## 4. Validation

- `pnpm --filter @saas/tenancy typecheck` passes.
- `pnpm --filter @saas/tenancy lint` passes.
- `pnpm --filter @saas/tenancy test` passes.

## 5. Tenant safety

- [x] Limits read from tenant's own context — no cross-tenant limit bypass possible.
