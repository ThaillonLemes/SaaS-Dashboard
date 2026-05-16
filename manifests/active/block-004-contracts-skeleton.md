---
id: block-004-contracts-skeleton
tier: M
kind: implementation
phase: Phase 0 — Foundation
scope: phase-bound
status: Complete
domain: packages/contracts
risk: low
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/TENANT.md
    - DOMAIN_ARCHITECTURE.md
    - decisions/ADR-0005-billing.md
    - templates/domain-doc.md
  modify: []
  create:
    - packages/contracts/package.json
    - packages/contracts/tsconfig.json
    - packages/contracts/README.md
    - packages/contracts/src/index.ts
    - packages/contracts/src/identity/types.ts
    - packages/contracts/src/tenancy/types.ts
    - packages/contracts/src/tenancy/plan.ts
    - packages/contracts/__tests__/types.test-d.ts
benchmarks: []
flags: []
metrics: []
contracts_published:
  - "@saas/contracts/identity/UserId"
  - "@saas/contracts/identity/Email"
  - "@saas/contracts/tenancy/TenantId"
  - "@saas/contracts/tenancy/TenantContext"
  - "@saas/contracts/tenancy/Plan"
  - "@saas/contracts/tenancy/PlanLimit"
  - "@saas/contracts/tenancy/PlanTier"
  - "@saas/contracts/tenancy/Role"
---

# Block 004 — `packages/contracts` skeleton

## 1. Purpose

Establish the cross-domain wire. Ships the branded primitives
(`TenantId`, `UserId`, `Email`), the `TenantContext` interface that every
domain consumes, the `Plan` / `PlanLimit` / `PlanTier` types per
ADR-0005, and the `Role` placeholder for Phase 1B.

## 2. Dependencies

- Block 001 (workspace must be ready).

## 3. Scope deviation note

PHASE_PIPELINE.md's tier table calls this block Tier S with just
`TenantId` + `UserId`. Two deviations applied:

1. **Tier bumped to M** because the orchestrator schema rejects
   `kind: implementation` for Tier S. Skeletons create files = implementation.
2. **Scope expanded** to include `TenantContext` (and dependencies:
   `Plan`, `PlanLimit`, `PlanTier`, `Role`). Reason:
   `TenantContext` per [protocols/TENANT.md:17-24](../../protocols/TENANT.md:17)
   belongs in `packages/contracts/`, not in `packages/tenancy/`. If we
   defer it to Block 006, Block 006 would have to reach into contracts —
   violating D1. Cleaner to publish all foundational tenancy types here.

Logged in `governance/log.md` (2026-05-15 entry).

## 4. Public surface (`packages/contracts/src/index.ts`)

```ts
export type { UserId, Email } from './identity/types';
export type {
  TenantId,
  TenantContext,
  AdminContext,
  Role,
} from './tenancy/types';
export type {
  Plan,
  PlanLimit,
  PlanTier,
} from './tenancy/plan';

// Branded-type constructors (NOT exported here — those live in producing
// domains; contracts is types-only per protocols/TENANT.md and Q2).
```

## 5. Types ship

### `identity/types.ts`

```ts
export type UserId = string & { readonly __brand: 'UserId' };
export type Email = string & { readonly __brand: 'Email' };
```

### `tenancy/types.ts`

```ts
import type { UserId } from '../identity/types';
import type { Plan } from './plan';

export type TenantId = string & { readonly __brand: 'TenantId' };

export type Role = 'owner' | 'admin' | 'member' | 'viewer';
// (Phase 1B Block 020 can expand this if needed; foundation ships the simple enum.)

export interface TenantContext {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly roles: ReadonlyArray<Role>;
  readonly plan: Plan;
}

export interface AdminContext {
  readonly userId: UserId;
  readonly reason: string;
  readonly auditId: string;
}
```

### `tenancy/plan.ts` (per ADR-0005)

```ts
export type PlanTier = 'starter' | 'pro' | 'enterprise';

export interface PlanLimit {
  readonly rowsPerMonth: number;
  readonly maxDashboards: number;
  readonly maxKpis: number;
  readonly maxErpConnections: number;
  readonly maxSeats: number;
}

export interface Plan {
  readonly tier: PlanTier;
  readonly limits: PlanLimit;
  readonly validUntil: string | null;  // ISO date; null = current paid plan
}
```

## 6. Constraints (T1 / Q2)

- **Types-only.** `packages/contracts/package.json` has zero runtime
  dependencies. No `import` from any other `@saas/*`. No runtime code.
- Branded-type **constructors** (validation + branding) do NOT live
  here. They live in the owning domain (`packages/identity` for `Email`
  / `UserId`; `packages/tenancy` for `TenantId`). This block ships only
  the types.
- All types are `readonly` where the contract guarantees immutability.

## 7. Tests (`__tests__/types.test-d.ts`)

Type-only tests (with `expect-type` or vitest's `assertType`). Verify:
- `TenantId` is NOT assignable to `UserId` (branded types distinct).
- `TenantContext.plan.tier` is one of the three literal tier values.
- `Plan` is `readonly`.

## 8. Validation

- `pnpm --filter @saas/contracts typecheck` passes.
- `pnpm --filter @saas/contracts lint` passes (no `import` from other
  packages; barrel-only public surface).
- `pnpm --filter @saas/contracts test` passes (type-only assertions).
- `packages/contracts/package.json` `dependencies` is `{}` (empty).
- ESLint's D1 rule is configured so any future deep-import attempt is
  caught.

## 9. Rollback signals

- A non-type-only import sneaks in.
- A runtime dep gets added.
- Branded-type test asserts `TenantId === UserId` instead of distinct.

## 10. Expected outcomes

After integration:
- Block 005 / 006 can `import type { TenantContext } from '@saas/contracts'`.
- Phase 1A's identity work has `UserId` / `Email` types to consume.
- Phase 1B's tenancy work has `TenantContext` / `Plan` / `Role` to
  consume.
- The Contracts Agent (defined in [AGENT_OPERATING_MODEL.md:163-194](../../AGENT_OPERATING_MODEL.md:163))
  is the single owner of this package from now on.

## 11. Tenant safety check

- [x] No tables introduced.
- [x] No repository methods.
- [x] No HTTP endpoints.
- [x] N/A — pure types-only package.

## 12. Cross-domain check

- [x] No deep imports across packages (D1) — `contracts` has zero
      package deps.
- [x] Cross-domain types live in `packages/contracts/` (D2) — this IS
      that package.
- [x] No utility duplication (C3) — this is the single source of
      cross-domain types.

## 13. Risks

- **Risk:** Phase 1B Block 020 wants a more complex `Role` type (RBAC with permissions). **Mitigation:** Contracts is additive-only; Phase 1B authors a contract block to extend (additive — no breaking change).
- **Risk:** Branded types cause subtle bugs at JSON boundaries (a serialized `TenantId` is just a `string`). **Mitigation:** Constructors validate + brand at boundary (Phase 1B); HTTP handlers in Phase 1+ always call the constructor.

## 14. Out of scope

- Branded-type constructors (live in producer domains; Phase 1A/1B).
- API request/response shapes (Phase 1+ blocks per endpoint).
- Error union types (per-domain, Phase 1+).

## 15. New abstraction

Branded types are an existing TypeScript idiom, not a new abstraction.
`TenantContext` is a contract per [DOMAIN_ARCHITECTURE.md:96](../../DOMAIN_ARCHITECTURE.md:96)
— not an abstraction layer.
