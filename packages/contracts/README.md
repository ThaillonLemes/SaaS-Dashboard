# `packages/contracts` — the cross-domain wire

## Identity

`@saas/contracts` is the typed wire format between bounded contexts. It is
**not a domain** in the DDD sense — it carries no business logic, no I/O,
no runtime code. It exists so that two domain packages can agree on the
shape of values that cross between them without either reaching into the
other's internals (D1, D2 in [PROTOCOLS.md](../../PROTOCOLS.md)).

The package's contract is its hardest constraint: **zero runtime
dependencies**. `package.json` `dependencies` is `{}` and stays that way.
The Governor audit rule on this package would flag any drift.

---

## What this owns

- Branded primitive types — `UserId`, `Email`, `TenantId`.
- The `TenantContext` and `AdminContext` interfaces every domain accepts
  as its operation boundary (T1, [protocols/TENANT.md](../../protocols/TENANT.md)).
- The `Plan` / `PlanLimit` / `PlanTier` types per
  [ADR-0005](../../decisions/ADR-0005-billing.md).
- The `Role` enumeration (foundation v1; Phase 1B may extend additively).

## What this does NOT own

- **Constructors / validators** for branded types. Those live in the
  *producer* domain (`packages/identity` for `Email` and `UserId`;
  `packages/tenancy` for `TenantId`). Constructing a branded type is
  validation; validation is logic; logic doesn't live here.
- **Runtime errors.** Cross-domain error unions belong here as types
  once Phase 1+ blocks define them; the throwing/catching code lives
  in producer/consumer domains.
- **API request/response shapes.** Those are HTTP contracts and live in
  per-endpoint contract docs (per `templates/api-contract.md`),
  added alongside the endpoints in Phase 1+.

Per D1, this package never reaches into other packages' internals — by
construction, since `dependencies` is empty.

---

## Public surface (`src/index.ts`)

```ts
export type { Email, UserId } from './identity/types';
export type { AdminContext, Role, TenantContext, TenantId } from './tenancy/types';
export type { Plan, PlanLimit, PlanTier } from './tenancy/plan';
```

Every export is a `type` re-export — no value re-exports, no default
exports.

---

## Internal structure

```
packages/contracts/
├── src/
│   ├── index.ts                 ← public barrel (types-only re-exports)
│   ├── identity/
│   │   └── types.ts             ← UserId, Email
│   └── tenancy/
│       ├── types.ts             ← TenantId, Role, TenantContext, AdminContext
│       └── plan.ts              ← PlanTier, PlanLimit, Plan (ADR-0005)
├── __tests__/
│   └── types.test-d.ts          ← type-level assertions (vitest typecheck)
├── package.json
├── tsconfig.json
└── README.md                    ← this file
```

The folder layout mirrors the *consuming* domain — `contracts/src/<domain>/`
holds the types that domain publishes. New domains add their own
`contracts/src/<domain>/` folder when they ship their first
cross-domain type.

---

## Dependencies

- **Runtime:** none. The empty `dependencies: {}` field is a contract
  (D2). A future block that needs to add a runtime dep here must change
  the contract first — almost certainly the right move is to put the
  logic elsewhere.
- **Dev:** `typescript`, `vitest` (typecheck-mode for type assertions).

No deep imports into any other `@saas/*` package, ever. Enforced by the
empty `dependencies` field.

---

## Database tables

None. This package has no I/O.

---

## Cross-cutting concerns

- **Tenancy:** ships the canonical `TenantContext` interface; every
  domain consumes it (T1).
- **Observability:** no instrumentation here — types have no runtime
  presence.
- **Errors:** no thrown errors here; per-domain error unions land in
  Phase 1+ blocks as additive contract types.

---

## Testing

Type-level only. `__tests__/types.test-d.ts` uses Vitest's `expectTypeOf`
in typecheck mode (`vitest run --typecheck`) to assert:

- Branded primitives are mutually non-assignable.
- `PlanTier` is exactly the ADR-0005 trio.
- `Role` is exactly the foundation four.
- `readonly` modifiers are part of the contract (stripping them changes
  the type identity).
- `TenantContext` fields carry the expected branded / union types.

These assertions also run during `pnpm --filter @saas/contracts
typecheck` because `__tests__/**` is in `tsconfig.json`'s `include`.

Run: `pnpm --filter @saas/contracts test`

---

## Current state

Bootstrap (Block 004) ships the foundation set. Future blocks add types
*additively*: new branded primitives, new domain folders, new contract
interfaces. No breaking changes without an L-tier block + ADR.

See [`STATE.md`](../../STATE.md) for cross-domain status.

---

## How to add a type

1. Read [`PROTOCOLS.md`](../../PROTOCOLS.md) and
   [`protocols/TYPESCRIPT.md`](../../protocols/TYPESCRIPT.md).
2. Confirm the type genuinely crosses domains (otherwise it lives in
   the owning domain).
3. Author a block manifest from [`templates/manifest-S.md`](../../templates/manifest-S.md)
   (additive contract changes are usually Tier S).
4. Add the type with a Tier-A INVARIANT JSDoc explaining its contract.
5. Re-export from `src/index.ts`.
6. Add type-level assertions to `__tests__/types.test-d.ts`.
7. Verify `dependencies` is still `{}`.
