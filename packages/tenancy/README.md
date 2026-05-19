# `packages/tenancy` — tenant lifecycle, membership, plans, roles

## Identity

`@saas/tenancy` owns the tenant boundary. It is the **sole issuer** of
`TenantContext` — the type that says "this operation is acting on
behalf of this user in this tenant" (T1 in
[protocols/TENANT.md](../../protocols/TENANT.md)). Every domain
operation in the workspace accepts a `TenantContext` constructed here
(or an `AdminContext` for explicit cross-tenant work).

The Phase 0 skeleton lands the three public-surface gates with bodies
that throw `TenancyError('NOT_IMPLEMENTED')`. Phase 1B Blocks 018–024
fill them in.

---

## What this owns

- The `getTenantContext(userId, tenantId)` factory — the only
  constructor for `TenantContext` in the workspace.
- The `enforceRole(ctx, requiredRole)` gate — RBAC check that throws
  when the actor lacks the required role.
- The `enforcePlanLimit(ctx, resource, currentValue)` gate — ADR-0005
  hard-cap check that throws when a write would exceed a tier's
  resource limit.
- The `TenancyError` domain-error class with stable `code`
  discriminant.
- Future Phase 1B state: `tenants`, `tenant_memberships`, `roles`
  tables; tenant lifecycle (created / suspended / deleted) events.

## What this does NOT own

- **User identity** — lives in `packages/identity` (Block 005
  skeleton; Phase 1A fills in).
- **Billing / Stripe integration** — Phase 3 `packages/billing` (per
  [ADR-0005](../../decisions/ADR-0005-billing.md)). This package
  enforces the `Plan` it's handed; it does not buy or upgrade plans.
- **Cross-domain types** — `TenantContext`, `Role`, `Plan`,
  `PlanLimit`, `TenantId` live in `@saas/contracts` (D2). The
  constructors / brand validators for those types live here.
- **Tenant-specific data** — dashboards, KPIs, ERP connections, and
  the rest are owned by their respective domain packages and accept
  `TenantContext` as their boundary.

Per D1, this package never reaches into another package's internals —
imports go through `@saas/contracts` only.

---

## Public surface (`src/index.ts`)

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

export class TenancyError extends Error {
  readonly code: string;
}

export type ResourceKind =
  | 'rowsPerMonth'
  | 'maxDashboards'
  | 'maxKpis'
  | 'maxErpConnections'
  | 'maxSeats';

// Re-exports for ergonomic consumer imports.
export type { Plan, Role, TenantContext };
```

Cross-domain types in `packages/contracts/src/tenancy/`:
- `TenantId`, `Role`, `TenantContext`, `AdminContext` (`types.ts`)
- `PlanTier`, `PlanLimit`, `Plan` (`plan.ts`)

---

## Internal structure

```
packages/tenancy/
├── src/
│   ├── index.ts            ← public surface (the three gates)
│   └── types.ts            ← TenancyError, ResourceKind
├── __tests__/
│   └── skeleton.test.ts    ← surface contracts + NOT_IMPLEMENTED guards
├── package.json
├── tsconfig.json
├── README.md               ← this file
└── STATE.md                ← local state (skeleton; Phase 1B fills)
```

---

## Dependencies

- **Runtime:** `@saas/contracts` — types only; no value imports.
- **Dev:** `typescript`, `vitest`.

No `@saas/observability` yet — added when Phase 1B wires real logging
inside the gates (manifest §7 leaves the dep optional in the
skeleton).

No deep imports from any `@saas/*` package (D1). Enforced by
`no-restricted-imports` in the workspace `.eslintrc.cjs`.

---

## Database tables

None yet. Phase 1B Block 018 lands:
- `tenants` — tenant records (id, name, plan tier, status, created_at).
- `tenant_memberships` — user → tenant + role join.
- `roles` — role definitions (foundation enum first; RBAC expansion in
  Block 020).

All tenant-scoped tables will carry `tenant_id NOT NULL` and an RLS
policy `tenant_id = current_setting('app.tenant_id')` per T-3 in the
tenant addendum.

---

## Cross-cutting concerns

- **Tenancy:** this IS the tenancy domain — every other package
  consumes `getTenantContext` as the entry point to tenant-safe
  operations (T-1).
- **Observability:** the skeleton emits no telemetry; Phase 1B wires
  `createLogger('tenancy.service')` inside the gates.
- **Errors:** thrown errors are `TenancyError` instances with a
  stable `code` discriminant (TS4 Style B inside the package; Style A
  `Result` shapes when types cross domain boundaries are introduced
  in a future contracts block).

---

## Plan enforcement (per ADR-0005)

Three tiers, hard caps, no metered overage:

| Tier | Rows/month | Dashboards | KPIs | ERP conns | Seats |
|------|-----------:|-----------:|-----:|----------:|------:|
| `starter` | 100,000 | 3 | 10 | 1 | 3 |
| `pro` | 1,000,000 | 20 | 50 | 5 | 15 |
| `enterprise` | unlimited¹ | unlimited¹ | unlimited¹ | unlimited¹ | unlimited¹ |

¹ Encoded as `Number.MAX_SAFE_INTEGER`-class values — never `Infinity`
(does not survive JSON serialization).

The skeleton ships the gate signature; the concrete tier→limit table
arrives with Phase 1B Block 021 (which also handles the Phase 3 →
`packages/billing` upgrade path).

---

## Testing

- Skeleton tests in `__tests__/skeleton.test.ts`:
  - Each of the three gates throws `TenancyError` with code
    `'NOT_IMPLEMENTED'`.
  - The package's re-exported `TenantContext` is type-equal to
    `@saas/contracts`'s `TenantContext` (Phase 1B consumers must not
    see a diverged shape).
  - `ResourceKind` enumerates exactly the `PlanLimit` axes
    (ADR-0005).
- Tenant-isolation tests (per T-9) are mandatory once Phase 1B lands
  real data access. The skeleton has no I/O, so isolation is N/A
  here.

Run: `pnpm --filter @saas/tenancy test`

---

## Current state

Skeleton only — see [`STATE.md`](./STATE.md). Phase 1B Blocks 018–024
fill in:
- 018 — `tenants` + `tenant_memberships` tables + RLS policies.
- 019 — `getTenantContext` membership / role / plan resolution.
- 020 — `enforceRole` role-hierarchy comparison + RBAC expansion.
- 021 — `enforcePlanLimit` cap table + Phase-3 billing hook.
- 022 — Tenant CRUD API.
- 023 — Onboarding UI wire-up.
- 024 — Tenant deletion (right to be forgotten).

Cross-domain state in the workspace [`STATE.md`](../../STATE.md).

---

## How to add to this domain

1. Read this file + [`PROTOCOLS.md`](../../PROTOCOLS.md) +
   [`protocols/TYPESCRIPT.md`](../../protocols/TYPESCRIPT.md) +
   [`protocols/TENANT.md`](../../protocols/TENANT.md).
2. Read [`ADR-0005`](../../decisions/ADR-0005-billing.md) if touching
   the `Plan` / `PlanLimit` shape.
3. Author a block manifest from
   [`templates/manifest-M.md`](../../templates/manifest-M.md) (or
   `manifest-L.md` for cross-package changes).
4. Implement within manifest scope (C2). Cross-package changes go
   through `packages/contracts/` first (D2).
5. Validate per manifest: typecheck, lint, test. Include
   tenant-isolation tests once I/O is present (T-9).
6. Open PR; tag for Governor review.
