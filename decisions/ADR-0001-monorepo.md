# ADR-0001: Monorepo + tool stack

- **Status:** Accepted
- **Date:** 2026-05-15
- **Deciders:** Workspace Governor + user (bootstrap conversation, 2026-05-15)
- **Tags:** infrastructure, repository, tooling

## Context

This is an AI-native multi-tenant SaaS workspace. The primary engineering
thesis is **maximum safe parallelism** — up to ~9 AI agents working
concurrently on different bounded contexts (see
[PARALLEL_IMPLEMENTATION.md](../PARALLEL_IMPLEMENTATION.md)). The repo
layout has to make package boundaries cheap to enforce, make cross-domain
types easy to share without publish-and-pull cycles, and make CI
incremental enough that any single block's PR runs in minutes, not hours.

Phase 0 Block 001 has to land the root tooling that every later block
depends on. The choice here cascades to every package's `package.json`,
every CI config, every `import` path, and the cost of every parallel
session.

## Decision

**Monorepo with pnpm workspaces + turborepo + TypeScript project
references + ESLint + Prettier + Vitest.** Layout per
[REPOSITORY_STRATEGY.md](../REPOSITORY_STRATEGY.md) (`apps/`,
`packages/`, `infrastructure/`).

Concretely:

| Concern | Choice |
|---------|--------|
| Package manager | `pnpm` ≥ 9.x |
| Workspace definition | `pnpm-workspace.yaml` with `apps/*`, `packages/*` |
| Task orchestration | `turbo` ≥ 2.x with `turbo.json` |
| Language | TypeScript ≥ 5.6 with `strict: true` + 6 additional strict-mode flags (see [protocols/TYPESCRIPT.md](../protocols/TYPESCRIPT.md)) |
| Project refs | Per-package `tsconfig.json` extends `tsconfig.base.json` |
| Linter | ESLint with `@typescript-eslint/strict-type-checked` + `import/order` + `no-restricted-imports` to enforce D1 |
| Formatter | Prettier (Format-on-save; no Prettier-vs-ESLint formatting conflicts) |
| Test runner | Vitest (unit + integration) |
| E2E | Playwright (in `apps/web/e2e/`) |
| Node version | 22 LTS, pinned via `.nvmrc` |
| Package name scope | `@saas/*` |

ESLint `no-restricted-imports` is configured to forbid deep imports
across packages (`@saas/*/src/*`), enforcing D1 (Domain Isolation) at
the lint layer.

## Alternatives considered

### Alternative A: npm workspaces

- **Pros:** Bundled with Node.js. No extra install step. Familiar.
- **Cons:** Slower install. Flat `node_modules` causes phantom-dependency
  issues. Less mature workspace semantics than pnpm.
- **Rejected because:** pnpm is the de-facto choice for AI-friendly
  monorepos in 2026; tooling assumes it; install cost matters when CI
  reruns are frequent.

### Alternative B: yarn (classic or berry)

- **Pros:** Workspaces support. Berry has zero-installs (Plug'n'Play).
- **Cons:** Berry's PnP breaks tools that assume `node_modules`; classic
  yarn is unmaintained.
- **Rejected because:** Pain at the edges (tool compat) is worse than
  pnpm's clean ergonomics.

### Alternative C: Nx instead of turborepo

- **Pros:** More powerful task graph; generators; affected-detection.
- **Cons:** Heavier opinionation; learning curve; harder to escape if
  the project outgrows it.
- **Rejected because:** turborepo's simplicity wins for early stage.
  Migration to Nx is feasible later if scale demands it.

### Alternative D: Single-package (no workspace)

- **Pros:** Simplest tooling.
- **Cons:** D1 (package boundaries) is impossible to enforce. `apps/`
  and `packages/` collapse into one `src/`. Loses every parallelism
  benefit.
- **Rejected because:** Defeats the workspace's primary engineering
  thesis.

### Alternative E: Multi-repo (one repo per domain)

- **Pros:** Strong isolation; per-domain release cadence.
- **Cons:** Cross-domain type sharing requires npm publishing or git
  submodules; AI coordination across repos is painful; CI multiplies.
- **Rejected because:** Single product, single team, single release
  cadence — multi-repo's costs exceed its benefits at this stage.

## Consequences

### Positive

- D1 (Domain Isolation) is enforced at three layers: package boundary,
  ESLint `no-restricted-imports`, TS project refs.
- `packages/contracts` becomes the single cross-domain wire — type
  changes propagate instantly via TS refs, no publishing step.
- Atomic cross-domain changes possible (a single PR touches contracts +
  producer + consumer when justified — L-tier blocks only).
- Turborepo caches incremental builds across CI runs — re-runs of
  unaffected blocks are seconds, not minutes.
- New developers / agents onboard via a single `pnpm install` and a
  single `pnpm doctor` — no cross-repo state sync.

### Negative

- pnpm requires a Node 22 install on every developer / CI machine.
- Turborepo's remote cache requires a separate service (Vercel-hosted
  free tier OK initially; self-hosted possible later).
- ESLint with `strict-type-checked` is slower than basic ESLint —
  acceptable trade-off given the type-safety yield.

### Neutral

- ESM-only TypeScript; no CommonJS in the workspace. Modern but
  occasionally requires extra config for legacy tools.

## Validation

How we'll know this was correct:

- **CI runtime:** typecheck + lint + test for a single-package change <
  3 minutes on the cold cache, < 1 minute on warm cache.
- **Parallel session count:** at peak (Phase 2+), 8+ concurrent
  worktrees with no merge conflicts on non-contracts files.
- **Onboarding:** a new agent can bootstrap from clone → green doctor
  in < 5 minutes.
- **Reconsideration trigger:** if any of (a) >50 packages, (b) per-app
  release cadences diverge, or (c) air-gapped enterprise builds become
  a requirement.

## Implementation impact

- **New blocks required:** block-001-monorepo-skeleton.
- **Migrations required:** none (no prior state).
- **Estimated effort:** S (1 block, < 1 hour AI implementation).

## References

- [REPOSITORY_STRATEGY.md](../REPOSITORY_STRATEGY.md) — operational layout reference
- [PARALLEL_IMPLEMENTATION.md](../PARALLEL_IMPLEMENTATION.md) — why D1 matters
- [protocols/TYPESCRIPT.md](../protocols/TYPESCRIPT.md) — language-layer rules implementing this stack
- Bootstrap conversation 2026-05-15 — scope answer (`@saas/`) and parallelism thesis
