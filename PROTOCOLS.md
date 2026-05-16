# SaaS Workspace Protocols

_Version: 3_
_Stewardship: Workspace Governor Agent only. Changes require Governor proposal + user approval + version bump + entry in `governance/log.md`._

This is the workspace constitution. Read once per session. It governs every implementation block, in every package, in every language.

---

## Priority hierarchy

When axioms or rules conflict, resolve in this order:

1. **Correctness** — P3, Q2, T1
2. **Quality** — Q1, Q3, Q4
3. **Consistency** — C1, C2, C3, C4
4. **Token efficiency** — everything else

Quality and consistency rank above token efficiency. Tokens are an
optimization; correctness, isolation, and clarity are contracts.

---

## The override clause

> Every axiom is absolute. To violate one, the block manifest must contain a
> line: `Axiom override: <ID> — <one-sentence justification>`. A commit that
> violates an axiom without that line is a bug, to be fixed in the next block,
> not retroactively justified.

The Governor maintains an aggregate dashboard at `governance/overrides.md`.
Patterns of repeated override on the same axiom signal a flaw in the axiom —
bring it to a Governor proposal, do not keep overriding silently.

---

## Group P — Process Discipline (6 axioms)

### P1 — Foundation before features

Types, contracts, and tests exist before the feature they support. A package's
public surface (`index.ts`, contract interfaces) is defined before the
implementation that fulfills it. New observability instruments (logs, metrics,
spans) are registered before the first call site emits them.

### P2 — Skeleton when risk warrants

For risky surfaces (auth, billing, public API, data migrations, integrations
with external systems), the interface lands first under a feature flag, then
activation is its own block. For low-risk internal features (CRUD, UI
components, internal utilities), skeleton-first is **not required** — direct
implementation is fine.

The block manifest declares whether skeleton-gating applies via `Risk:` field.

### P3 — Green tree

No commit leaves type-check, lint, tests, or CI broken. A red CI is the
block's responsibility to fix before merge — never a "follow-up." If a block
discovers it cannot satisfy P3, it splits or rolls back; it does not commit
red.

### P4 — Measure where it matters

Benchmark and measure when:
- The block touches a known hot path (query aggregation, dashboard render, API gateway, batch job).
- The block changes a performance-sensitive contract.
- The manifest explicitly declares `Performance-critical: yes`.

For non-hot-path work (CRUD endpoints, UI components, internal utilities),
benchmarking is optional. Functional correctness via tests is mandatory in
all cases.

### P5 — Independently revertible

A single block's `git revert` (or package-scoped revert) compiles and passes
type-check. Later blocks depend on the interface shape an earlier block
introduced — never on its implementation details. Block N+1 cannot assume
Block N's internal data structures.

### P6 — Decisions on disk

Every non-trivial decision lives in a manifest, ADR (Architecture Decision
Record), or block retrospective. Chat is volatile; files are durable. A
decision that exists only in conversation will be re-litigated three blocks
later. ADR template: `templates/adr-template.md`.

---

## Group Q — Code Quality (4 axioms)

### Q1 — Simplicity wins

The simplest correct implementation wins. No abstraction, generic, hook,
indirection, or layer introduced "for future flexibility."

**Rule of three:** a pattern becomes an abstraction at its third concrete
use, not before. The first two uses live duplicated; the abstraction emerges
from the third when the shape is known, not predicted.

### Q2 — Types carry invariants

Encode impossible states as unrepresentable. Validate input at system
boundaries (HTTP, queue messages, external API responses, user input); trust
types within the system. Do not write defensive `if x !== undefined` checks
on non-optional values. Use branded types (`type TenantId = string &
{ readonly __brand: 'TenantId' }`) to carry validated state.

### Q3 — Names are the documentation

Identifiers declare the WHAT. Comments only declare the WHY (a hidden
constraint, a non-obvious choice, a performance reason, a cross-system
implication). See the Comment Charter below for full standards.

### Q4 — Locality of reasoning

A reader understands a function from its signature, body, and types alone.
No chase >2 levels of indirection. No magic globals. No mystery numbers —
every literal that isn't 0, 1, or -1 has a named constant. No "smart" indirect
imports through barrel re-exports for non-public surface.

---

## Group C — Consistency (4 axioms)

### C1 — Mirror the neighbors

New code adopts the conventions of the surrounding file (naming, import
order, error-handling pattern, log channel, formatting). Same problem, same
solution as last time in this package. If you find divergent conventions
across files, the fix is a refactor block — not a new third convention.

### C2 — Minimum diff

Changes touch only what the manifest names. No drive-by refactor, no
opportunistic cleanup, no formatting churn outside scope. A change to add a
field doesn't reorder unrelated fields.

### C3 — One way to do X

If a utility exists in `packages/<applicable>`, use it. Creating a parallel
utility requires explicit manifest authority — `Manifest field: New
abstraction — justification`. Discovery cost is real; pay it once.

### C4 — Delete debris

Removed code leaves no `@ts-ignore` orphans, no `eslint-disable` annotations
that no longer apply, no commented-out blocks, no stale doc references, no
orphan tests. If it's gone, it's gone — and the manifest's "Files modified"
list shows the deletion.

---

## Group D — Domain Isolation (2 axioms)

These are the axioms that **enable parallel AI implementation**. Violations of
D-axioms create cross-domain coupling that serializes work and creates merge
conflicts.

### D1 — Domain isolation

Code in one bounded context (one package) does NOT reach into another's
internals. Inter-package communication goes only through the published
contract — a TypeScript interface exported from `packages/contracts/` or
from the producer package's `index.ts` public surface.

- ✅ `packages/analytics` imports `import { TenantContext } from '@saas/contracts'`
- ❌ `packages/analytics` imports `import { internalCache } from '@saas/identity/src/cache'`

Tooling enforces: each package declares its public surface in `index.ts`; no
deep imports from another package's `src/` allowed (ESLint rule).

### D2 — Contract before consumer

A new cross-domain contract is published as a typed interface in
`packages/contracts/` BEFORE the consumer block lands. The consumer block
depends on the contract block, not on the producer's implementation.

Concretely:
1. Block A creates the contract (interface, types, error union) in `contracts/`.
2. Block B (consumer) lands, depending only on the contract.
3. Block C (producer) lands the implementation. May come before or in parallel with B; doesn't matter to B.

This allows producer and consumer blocks to run in parallel.

---

## Group T — Tenant Safety (2 axioms)

Multi-tenancy is foundational. These axioms are **never** overridden.

### T1 — Tenant safety

Every query, every operation, every persisted entity carries a tenant scope.
No global state at the data layer. No cross-tenant data access without
explicit privileged context (admin tools, support workflows — and these
require their own audit trail).

Concretely:
- All database tables have a `tenant_id` column (or are explicitly marked
  cross-tenant infrastructure like `tenants`, `migrations`).
- All repository methods accept a `TenantContext` argument (or operate within
  a transaction that's already tenant-scoped).
- All HTTP handlers resolve `TenantContext` from the request and pass it to
  the service layer.
- Cross-tenant operations use `AdminContext` (a distinct, audited type).

T1 is **never** override-able. A block that needs cross-tenant access uses
`AdminContext`; it does not violate T1.

### T2 — Tenant fairness

Per-tenant resource limits are enforced at the relevant boundary:
- Database: query timeout per request, statement-level resource limits.
- API: rate limit per tenant per endpoint class.
- Background jobs: per-tenant queue weight or fair scheduler.
- Storage: per-tenant quota enforced before write.

A new shared resource (cache, queue, batch processor) must declare its
per-tenant fairness mechanism in the block manifest.

---

# Comment Charter

_Operationalizes Q3. Applies to every source file in the workspace._

## Core principle

> Every comment earns its tokens. If removing it would not lose information
> unrecoverable from code, types, or commit history — remove it.

## Tier table

| Tier | Purpose | Required? |
|------|---------|-----------|
| **A — Mandated** | Safety / invariants / public API contracts | YES |
| **B — Encouraged** | Non-obvious choices, perf reasons, tenant/contract implications | When applicable |
| **C — Allowed rare** | Temporary workarounds, dated TODOs with anchors | With tracking |
| **D — Forbidden** | Code narration, banners, restatement, history, self-evident | NEVER |

## Tier A — Mandated patterns

**INVARIANT** on type contracts beyond the signature:
```ts
/** INVARIANT: Tenant scope is enforced by repository constructor — handlers must not bypass. */
export class AnalyticsRepository { ... }
```

**Public API docs** on exported functions/types (JSDoc):
- One-sentence purpose.
- Optional paragraph on constraints, throws, or non-obvious behavior.
- NEVER duplicate implementation in prose.
- NEVER trivially restate parameters.

## Tier B — Encouraged prefixes

When the WHY is non-obvious. Prefix-tagged for grep:

- `// WHY:` unusual choice
- `// PERF:` performance-driven decision with bench reference
- `// TENANT:` tenant-isolation implication
- `// CONTRACT:` cross-domain contract implication
- `// DB:` database-schema or query implication
- `// SECURITY:` security-sensitive decision

## Tier C — Allowed but rare

Tracked workarounds and dated TODOs:
```ts
// HACK: pg-driver issue #1234 — remove after driver update.
// TODO(block-045): replace stub with real impl after Identity Phase ships.
// TODO(2026-Q4): revisit when next billing provider supports webhooks.
```

Bare TODOs without a tracking anchor are silent debt — forbidden.

## Tier D — Forbidden patterns

**Code narration:**
```ts
// increment counter      ← FORBIDDEN
counter += 1;
```

**Section banners:**
```ts
// =================================
//        VALIDATION SECTION
// =================================
```
→ FORBIDDEN. Use functions and modules; visual banners are noise.

**Restatement of names:**
```ts
/** Constructor for User. */    ← FORBIDDEN
constructor() { ... }
```

**Implementation changelog in code:**
```ts
// Was using fetch, switched to axios because of timeout handling.
// Updated 2026-05-14 to handle retries.
```
→ belongs in commit message or block retrospective.

**Block/task stamps:**
```ts
// Added for Block 042 (Analytics Phase 2).    ← FORBIDDEN
```

**Bare TODOs:**
```ts
// TODO: fix this later     ← FORBIDDEN
```

## Density target

1 comment per 30 LOC averaged. Files exceeding 1/10 LOC get flagged by
Governor audit.

## Enforcement

- **Tier A:** lints where possible (TypeDoc / TSDoc enforcement, ESLint rules for missing JSDoc on exports).
- **Tier D:** Governor periodic audit (grep-based) + Q3 axiom.
- **Density:** Governor periodic audit.

---

# Language addenda

Loaded conditionally based on what an agent is touching:

- **TypeScript (universal)** → `protocols/TYPESCRIPT.md`
- **React (frontend)** → `protocols/REACT.md`
- **PostgreSQL / data layer** → `protocols/DATABASE.md`
- **HTTP / REST APIs** → `protocols/API.md`
- **Multi-tenancy** → `protocols/TENANT.md`

A domain agent loads ONLY the addenda relevant to its work.

---

# Block manifest tiers

Manifests declare their tier in the first metadata line.

| Tier | Use case | Template |
|------|----------|----------|
| **S — Spike/Small** | Investigation, single-file fix, lint sweep, doc-only change | `templates/manifest-S.md` |
| **M — Standard** | Default implementation block | `templates/manifest-M.md` |
| **L — Gate/Cross-domain** | Cross-package contracts, migrations, public API changes, security blocks | `templates/manifest-L.md` |

## Manifest metadata fields (all tiers)

- `Tier:` — S, M, or L
- `Kind:` — implementation | investigation | gate | refactor | migration
- `Domain:` — which package(s) this block touches
- `Risk:` — low | medium | high (drives whether P2 skeleton-first applies)
- `Performance-critical:` — yes | no (drives whether P4 bench applies)
- `Parallel-with:` — block IDs this can run concurrently with (optional)
- `Status:` — Pending | InProgress | Complete | Reverted
- `Axiom override:` — `<ID> — <justification>` (only if violating an axiom)
- `Feature:` — cross-domain feature name (if applicable, see `features.md`)

## Cross-domain features

Features spanning multiple packages are tracked in `features.md`
(Governor-maintained). A block participating in a feature names it via the
`Feature:` field.

---

# Coordination rules

## Per-block lifecycle

1. Agent reads `PROTOCOLS.md` + `INDEX.md` + relevant addenda.
2. Agent reads `STATE.md` to know what's happening across domains.
3. Agent reads the block manifest.
4. Agent reads the contracts and types it depends on.
5. Agent implements within manifest scope (C2).
6. Agent validates: type-check, lint, tests, conditional bench (P4).
7. Agent updates relevant package's local state file (if any).
8. Agent commits + pushes a single PR (one block = one PR).
9. Governor reviews, runs CI, integrates.

## Per-phase lifecycle

1. Phase folder created at `./phases/phase-<name>/`:
   - `roadmap.md` — block list (frozen at phase start)
   - `decisions.md` — architectural decisions for the phase
   - `exit.md` — exit criteria + PASS/FAIL stamps
2. Block manifests created in `./manifests/active/`.
3. Blocks execute (most in parallel per `Parallel-with:`).
4. Last block runs exit criteria; `exit.md` stamps PASS.
5. Governor archives phase folder + completed manifests + retrospectives.

## Ownership rules

- **Workspace files** (`./**`): Governor edits only.
- **Package files** (`packages/<x>/**`): that domain's agent edits only.
- **Cross-cutting** (`packages/contracts/`, `infrastructure/db/migrations/`): Contracts Agent / Database Agent only.
- **Block manifests**: created pre-block, frozen at block start.
- **No agent writes another package's internals.** Cross-package work goes through a contract change in `packages/contracts/`.

---

# Version history

- **v1 — initial (2026-05-14)** — 18 axioms (P/Q/C/D/T) + Comment Charter + language addenda pointers + manifest tiers + coordination rules. Cognition lived in a `foundation/` subfolder.
- **v2 — V3 topology (2026-05-15)** — Promoted cognition files to workspace root. Added orchestrator (`/orchestrator/`), `.governor/` private workspace, `.claude/skills/` (11 governor commands), `CLAUDE.md` workspace bootstrap, `WORKSPACE_MAP.md`. Parallel-implementation upgrade: one Domain Agent per package, each in its own Claude Code worktree (`.claude/worktrees/<domain>-<slug>/`). Up to ~9 agents in flight simultaneously after Phase 0. No changes to axioms — only topology and tooling.
- **v3 — scope rename (2026-05-15)** — `@app/` → `@saas/` across cognition, protocols, templates, `orchestrator/package.json`. Header `Version:` field corrected (was `1` since v2 landed). No axiom changes. Proposal: `.governor/proposals/2026-05-15-scope-rename.md`.
