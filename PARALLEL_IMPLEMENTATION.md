# Parallel Implementation

This is the central engineering thesis of the project: **up to ~9 AI agents
work concurrently on different packages without stepping on each other.**
The axioms, contracts, package boundaries, worktree isolation, and the
orchestrator are all designed to enable this.

If you only read one section here, read "The four pillars" below.

---

## The four pillars

Parallelism in this workspace rests on four mechanisms. Lose any one and
the model degrades.

### 1. Package boundaries (D1)

Each domain is a `packages/<name>/` package with a public surface in
`index.ts`. Deep imports across packages are **forbidden** and enforced by
ESLint (`no-restricted-imports` configured to block `@app/*/src/*`).

Two agents working on `packages/analytics` and `packages/dashboard` cannot
break each other's internals — the type system literally won't let them.

### 2. Contract-before-Consumer (D2)

Cross-domain work is decomposed so the **contract block lands first** in
`packages/contracts/`. Once it merges, producer and consumer blocks are
free to run in parallel because they depend only on the typed contract,
not on each other's implementation.

### 3. Worktree-per-package

Every Domain Agent operates in its own Claude Code worktree:

```
.claude/worktrees/<domain>-<slug>/
```

on a branch named `agent/<domain>/block-<NNN>-<slug>`. The Governor's
`governor scan` command enumerates worktrees and writes a snapshot to
`.governor/orchestrator/.cache.json`, which feeds `STATE.md`.

Worktrees give each agent:
- An isolated working tree (no `git status` collisions between sessions).
- Independent uncommitted state.
- A branch that's already named correctly for the integration step.

### 4. Single-writer rule per package

Only **one** agent at a time per package. Enforced by the Governor at
block-assignment time via `STATE.md`. If two blocks both target
`packages/identity/**`, the second one waits (or has its scope narrowed
to a different package).

Most blocks touch only one package, so the rule rarely binds.

---

## Decomposition rules

When a feature spans multiple packages, decompose it BEFORE starting.

### Step 1 — Identify the packages involved

Example feature: "Show top-10 customers by revenue on the main dashboard."

Packages touched:
- `analytics/` — new KPI definition + computation.
- `dashboard/` — new widget definition.
- `ui-kit/` — possibly a new visualization component (if not already
  present).
- `contracts/` — new types (TopCustomersKpiResult, TopCustomersWidget).

### Step 2 — Define the contracts first

Identify all cross-domain types:
- `TopCustomersKpiResult` — analytics output shape.
- `TopCustomersWidget` — dashboard widget config.

These go in `packages/contracts/src/<domain>/` as **block 1**.

### Step 3 — Identify parallelizable blocks

| Block | Package | `depends_on` | `parallel_with` |
|-------|---------|--------------|-----------------|
| 1. Contracts | `contracts` | — | — |
| 2. KPI compute | `analytics` | block 1 | blocks 3, 4 |
| 3. Widget definition | `dashboard` | block 1 | blocks 2, 4 |
| 4. Chart component | `ui-kit` | (optional) block 1 | blocks 2, 3 |
| 5. Integration in app | `apps/web` | blocks 2, 3, 4 | — |

Blocks 2, 3, 4 run in three concurrent worktrees after block 1 merges.
Block 5 serializes them.

### Step 4 — Declare in manifests

Each block's manifest frontmatter declares:
- `dependencies:` — block IDs that must merge first.
- `parallel_with:` — block IDs that can run concurrently.
- `files: { read, modify, create }` — every path this block touches.

The Governor's `governor preflight <manifest>` validates these against the
schema; `governor conflicts` confirms no file-scope collision; `governor
next` computes the DAG.

---

## Agent coordination protocol

### Starting a parallel block

1. User (or Governor) assigns a block manifest to an agent role.
2. Agent reads `STATE.md` to confirm no other agent active in this
   package.
3. Agent reads `PROTOCOLS.md` + relevant `protocols/*.md` + the manifest.
4. Agent creates the worktree:
   ```bash
   cd <project-root>
   git worktree add .claude/worktrees/<domain>-<slug> -b agent/<domain>/block-<NNN>-<slug>
   ```
5. Agent reads the package's `README.md` and (optional) `STATE.md`.
6. Agent reads the contracts it depends on
   (`packages/contracts/src/<domain>/*.ts`).
7. Agent works inside the worktree until validation passes.
8. Agent pushes the branch and opens a PR.

### Finishing a parallel block

1. Agent completes work, validates per manifest (typecheck, lint, tests,
   conditional bench per P4).
2. Agent updates the package's local docs.
3. Agent sets manifest `status: Complete`.
4. Agent pushes the worktree branch.
5. Agent notifies the Governor session: "block-<NNN> ready for review."
6. Governor runs `governor preflight` + `governor conflicts` + CI on the
   PR; then `governor integrate <repo> <branch>` (dry-run first, then
   live on user approval).
7. Governor updates `STATE.md` by hand from `STATE.proposed.md`.
8. Governor removes the worktree after merge:
   ```bash
   git worktree remove .claude/worktrees/<domain>-<slug>
   ```

### Handling conflicts

Two agents targeting the same package at the same time = **violation of the
single-writer rule.** The Governor catches this at block assignment.

If somehow conflicting work lands:

- The first PR to merge wins.
- The second agent rebases its worktree branch on the new `main` and
  continues, OR splits the block into post-merge work.

If the conflict is in `packages/contracts/`:
- The Contracts Agent owns conflict resolution.
- All consumers wait until contracts settle.

---

## Common parallelism patterns

### Pattern A — Independent package bring-up (Phase 1 sweet spot)

Four backend packages need their skeletons. None depends on the others
yet.

**Setup:** 4 Tier-M blocks (one per package). Each declares
`parallel_with: [<the other three>]`.

**Result:** 4 Claude Code sessions, 4 worktrees, 4 PRs merge in any order
into `main`. The Governor handles each integration as it lands.

### Pattern B — Producer/consumer with contract pre-declared

Contract block lands first; producer and consumer run in parallel.

**Setup:**
- Block 1 — `contracts/` (Contracts Agent).
- Block 2 — producer (e.g., Analytics Agent), `depends_on: [block-001]`.
- Block 3 — consumer (e.g., Dashboard Agent), `depends_on: [block-001]`,
  `parallel_with: [block-002]`.

**Result:** after Block 1 merges, the Governor unblocks Blocks 2 and 3
simultaneously. Two agents work in parallel.

### Pattern C — UI iteration on stable backend

Backend contract is frozen. Frontend iterates rapidly with UI variations.

**Setup:** N Tier-S UI blocks in `apps/web/` and `packages/ui-kit/`. All
`parallel_with: [<each other>]`. No backend dependency.

**Result:** rapid visual iteration without backend coordination. Useful
during the Composition phase (Phase 2) once analytics is wired.

### Pattern D — Migration with backward compat

Schema migrations risk parallel-block conflicts. Strategy:

1. **Block 1** (Database Agent): add new column/table, nullable /
   non-breaking. Land in main.
2. **Blocks 2..N** (Domain Agents in parallel): producers/consumers read
   old + write new.
3. **Block N+1** (Database Agent): tighten constraint or remove old
   column once all consumers are migrated.

**Result:** schema changes are tolerable for parallel work because
they're additive in steps, and consumers self-pace.

### Pattern E — Frontend + Backend leapfrog

Frontend Agent works on UI for a feature whose backend isn't ready,
mocking the contract types from `packages/contracts/`.

**Setup:**
- Block 1 — Contracts (define the API contract types).
- Block 2 — Frontend (consume the types; mock the HTTP call).
- Block 3 — Backend Domain (implement the producer).
- Block 4 — Backend App (wire the HTTP endpoint).
- Block 5 — Frontend (swap mock for real call; depends on block 4).

**Result:** Blocks 2 and 3 run in parallel against the same contract.
Block 4 unblocks block 5.

---

## Anti-patterns (do NOT do these)

### Sharing internal types across packages

```ts
// In packages/dashboard:
import { internalKpiCache } from '@app/analytics/src/internal/cache';   // ❌
```

D1 violation. ESLint catches it. If you need the type, expose it via the
producer's `index.ts` OR move it to `packages/contracts/`.

### Cross-package database writes

```ts
// In packages/dashboard:
db.update('analytics_kpi_cache', ...);   // ❌ — that's analytics' table
```

Fix: ask analytics to expose a method, or rethink the design.

### Two agents in the same package at the same time

Single-writer rule. Always check `STATE.md` before starting. The Governor
should have blocked this at assignment.

### "Just this once" deep imports

D1 violations always start as "just this once." They never end there. No
exceptions without an explicit `Axiom override: D1 — <reason>` in the
manifest, and even then the Governor pushes back.

### Contract changes without coordination

Modifying `packages/contracts/` while consumers depend on the old shape
breaks parallel work for everyone. Contract changes are S, M, or L blocks
authored by the Contracts Agent — never by a Domain Agent in passing.

### Working outside a worktree

A Domain Agent that edits the main checkout instead of a worktree:
- Risks colliding with another session's uncommitted state.
- Skips the branch-naming convention the orchestrator relies on.
- Makes `governor integrate` impossible (it expects a branch in a known
  location).

Always work in your assigned worktree.

---

## How the Governor monitors parallelism

`STATE.md` shows, at a glance, the active worktree per package:

| Package | Active agent | Current block | Worktree | Status |
|---------|--------------|---------------|----------|--------|
| identity | Agent-A | block-007-mfa | `.claude/worktrees/identity-mfa/` | InProgress |
| analytics | Agent-B | block-019-revenue-kpi | `.claude/worktrees/analytics-revenue/` | InProgress |
| dashboard | (none) | — | — | — |
| ui-kit | Agent-C | block-031-chart-component | `.claude/worktrees/ui-kit-chart/` | InProgress |

Three agents in parallel, no overlap. The Governor reviews PRs as they
ripen, runs integrate, updates the table.

If a new block is requested in a package with an active agent, the
Governor either queues it (`status: Pending`) or pushes back on the
proposer to split the block.

---

## Orchestrator's role in parallelism

Three commands are critical to running parallel work safely:

| Command | When to run | What it tells you |
|---------|-------------|-------------------|
| `governor scan` | Continuously (via `post-commit-scan.sh` hook) | Refreshes `.cache.json` — the snapshot every other command reads |
| `governor next` | When planning the next wave of blocks | Topological order of pending manifests + dependency edges |
| `governor conflicts` | Before authorizing a new block | Any file claimed by 2+ active manifests |

Skip these and you're flying blind. Run them and you can confidently
assign 8 blocks at once knowing the boundaries hold.

---

## Token efficiency in parallel work

Each agent's session loads ONLY:
- `PROTOCOLS.md` (constitution, once per session, ~12 KB).
- `STATE.md` (cross-domain awareness, ~2 KB).
- Its own package's `README.md` + optional `STATE.md` (~3 KB).
- Relevant `protocols/*.md` for its tech stack (~4 KB each, 1-3 loaded).
- Its block manifest (~2-5 KB).
- The contracts it depends on (~1-3 KB).

**Total per-agent context: 25-35 KB.** Much smaller than loading the
whole repo. Eight agents can each operate at this budget without
overlapping context — and they don't need to. Each is sandboxed by the
package boundary, so a Domain Agent has no business reading another
domain's source anyway.

The Governor session loads more (the full cognition layer) because it
must reason cross-package — that's the correct distribution of context.

---

## Scaling guidance

| Project stage | Practical parallelism |
|---------------|-----------------------|
| Phase 0 (foundation) | 1 active session (Governor authoring + DevOps boots tooling). Sequential by necessity. |
| Phase 1 (domain skeletons) | 4-6 parallel sessions. Most packages are bring-ups; few dependencies. |
| Phase 2 (composition) | 5-8 parallel sessions. Analytics + Dashboard + UI-Kit + Frontend + supporting backend domains. |
| Phase 3 (productization) | 6-9 parallel sessions. Billing / Notifications / Audit each bring up; existing domains continue iterating. |
| Phase 4+ (waves) | 3-6 parallel sessions. Most blocks are S or M; waves last 1-2 weeks. |

Peak parallelism is a tool, not a goal. Run as many sessions as you can
*usefully review and integrate*. Eight blocks open with no Governor
attention is worse than three blocks open with prompt integration.
