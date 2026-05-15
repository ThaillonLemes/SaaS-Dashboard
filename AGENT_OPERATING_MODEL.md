# Agent Operating Model

Who does what. Who owns what. How ~9 agents coordinate concurrently without
stepping on each other.

This project is engineered for **maximum safe parallelism**. After Phase 0,
up to 9 Claude Code sessions run simultaneously, each owning exactly one
package. Coordination is structural (D1/D2 axioms + single-writer rule) and
mechanical (Claude Code worktrees + Governor-maintained `STATE.md`), not
social.

---

## Agent topology

| Role | How many at once | Scope of ownership | Worktree |
|------|------------------|---------------------|----------|
| **Workspace Governor** | exactly 1 | Cognition layer (root `*.md`), `.governor/**`, integration, audits, cross-package coordination | none — operates on `main` |
| **Contracts Agent** | exactly 1 | `packages/contracts/**` | `.claude/worktrees/contracts-<slug>/` |
| **Database Agent** | exactly 1 | `infrastructure/db/**` | `.claude/worktrees/db-<slug>/` |
| **Identity Agent** | exactly 1 | `packages/identity/**` | `.claude/worktrees/identity-<slug>/` |
| **Tenancy Agent** | exactly 1 | `packages/tenancy/**` | `.claude/worktrees/tenancy-<slug>/` |
| **Integrations Agent** | exactly 1 | `packages/integrations/**` | `.claude/worktrees/integrations-<slug>/` |
| **Normalization Agent** | exactly 1 | `packages/normalization/**` | `.claude/worktrees/normalization-<slug>/` |
| **Analytics Agent** | exactly 1 | `packages/analytics/**` | `.claude/worktrees/analytics-<slug>/` |
| **Dashboard Agent** | exactly 1 | `packages/dashboard/**` | `.claude/worktrees/dashboard-<slug>/` |
| **UI-Kit Agent** | exactly 1 | `packages/ui-kit/**` | `.claude/worktrees/ui-kit-<slug>/` |
| **Observability Agent** | exactly 1 | `packages/observability/**` | `.claude/worktrees/observability-<slug>/` |
| **Frontend App Agent** | exactly 1 | `apps/web/**` | `.claude/worktrees/web-<slug>/` |
| **Backend App Agent** | exactly 1 | `apps/api/**` | `.claude/worktrees/api-<slug>/` |
| **DevOps Agent** | 0-1 (on demand) | `infrastructure/ci/**`, `infrastructure/deploy/**`, `turbo.json`, root tooling | `.claude/worktrees/devops-<slug>/` |

**Theoretical peak: 14 sessions.** Practical peak post-Phase-0: ~9 (the
Governor + most active backend domain agents + UI-Kit + Frontend or DevOps).

The user decides which sessions to spin up at any moment. The Governor
maintains `STATE.md` showing which agent holds which package's worktree.

---

## Why one agent per package

D1 (Domain Isolation) + D2 (Contract-before-Consumer) make this safe:

- A Domain Agent's worktree branch only touches files inside its own package
  (`packages/<x>/**`). The package boundary is enforced by ESLint
  (no-deep-imports) — the agent literally cannot break another domain by
  accident.
- Cross-domain coordination happens through `packages/contracts/` — owned by
  the Contracts Agent (a single bottleneck for type changes, by design).
- Schema coordination happens through `infrastructure/db/migrations/` —
  owned by the Database Agent.
- All other concurrent edits are in disjoint trees, so PR merges almost
  never conflict at the file level.

When two agents *do* need to touch the same file (rare — usually
`packages/contracts/src/<domain>/`), the Contracts Agent serializes the
work as a sequence of small blocks, each with its own manifest.

---

## Workspace Governor

### Owns

- Every root cognition file: `PROTOCOLS.md`, `STATE.md`, `INDEX.md`,
  `COGNITIVE_ARCHITECTURE.md`, `REPOSITORY_STRATEGY.md`,
  `DOMAIN_ARCHITECTURE.md`, `PARALLEL_IMPLEMENTATION.md`,
  `PHASE_PIPELINE.md`, `AGENT_OPERATING_MODEL.md`, `WORKSPACE_MAP.md`,
  `features.md`, `CLAUDE.md`.
- `protocols/**`, `templates/**`.
- `manifests/**`, `phases/**`, `decisions/**`.
- `governance/**` (`overrides.md`, `log.md`, audit reports).
- `.governor/**` (private Governor workspace: audits, proposals, maps).
- `orchestrator/**` and `orchestrator.config.yaml`.

### Responsibilities

- Author and maintain the cognition layer.
- Run the orchestrator's deterministic commands: `governor scan`,
  `state`, `next`, `conflicts`, `doctor`, `audit`, `preflight`,
  `integrate`, `undo`, `metrics`, `churn`, `ownership`, `verify`. See
  `.claude/skills/governor-*/SKILL.md` for the slash-command surface.
- Review PRs from Domain Agents. Run CI. Merge via `governor integrate`.
- Update `STATE.md` on every integration (authoritative cross-domain state).
- Update `features.md` when a cross-domain feature progresses.
- Aggregate `Axiom override:` declarations into `governance/overrides.md`.
- Audit periodically for drift, oversized files, comment violations,
  manifest age, ownership leaks.
- Propose structural changes via `.governor/proposals/`. Implement only
  after explicit user approval and a version bump on the affected
  canonical file.

### Does NOT do

- Write production code in `apps/**` or `packages/**`.
- Edit another agent's worktree files.
- Bypass approval pipeline for structural changes.

### Operating rules

- Always check `STATE.md` first.
- Inspect freely; mutate only the cognition layer + `.governor/`.
- Every decision logs to `governance/log.md`.
- Slash commands surface in `.claude/skills/governor-*` — use them in
  preference to ad-hoc orchestrator invocations.

---

## Domain Agent (template — applies to every package-scoped agent)

### Owns

- Exactly one `packages/<domain>/**` package.
- That package's `README.md` and (optional) `STATE.md`.
- The block manifests in `manifests/active/` whose `domain:` frontmatter
  field names this package.
- Its package's `package.json` dependencies.

### Responsibilities

- Read the block manifest before starting.
- Implement strictly within manifest scope (C2 — minimum diff).
- Follow axioms; document any necessary `Axiom override:` in the
  manifest.
- Validate per manifest: `pnpm typecheck`, `pnpm lint`, `pnpm test`,
  conditional benchmark per P4.
- Update the package's local docs (`README.md`, optional `STATE.md`).
- Set manifest `status:` to `Complete` on success.
- Commit and push the worktree branch; open a PR.
- Notify the Governor session that the PR is ready.

### Does NOT do

- Touch any other package's internals (D1).
- Modify `packages/contracts/` directly — propose contract changes to
  the Contracts Agent (separate block).
- Modify `infrastructure/db/**` — propose schema changes to the
  Database Agent (separate block).
- Edit cognition-layer files (root `*.md`, `protocols/**`,
  `templates/**`, `governance/**`, `.governor/**`).
- Start work in a package currently held by another agent per `STATE.md`
  (single-writer rule).

### Operating rules

- **Worktree:** create a Claude Code worktree at
  `.claude/worktrees/<domain>-<slug>/` on a branch named
  `agent/<domain>/block-<NNN>-<slug>`. The Governor's `governor scan`
  command enumerates worktrees and writes them to `STATE.md`.
- **Single-writer per package:** before starting, confirm `STATE.md`
  shows no other agent active in this package. If it does, wait or
  queue.
- **Cross-domain communication:** only through `packages/contracts/`.
  Never deep-import another package's internals.
- **Scope discipline:** if a needed change is out of scope, stop and
  propose a separate block. Do not silently widen the manifest.
- **One block = one PR.** Smaller PRs merge faster, are easier to
  revert, and don't pin down other agents.

---

## Contracts Agent

### Owns

- `packages/contracts/**` — TypeScript types, interfaces, branded
  primitives, error unions.

### Responsibilities

- Author cross-domain type definitions.
- Maintain backward compatibility (additive changes preferred; breaking
  changes are L-tier with a migration block per consumer).
- Coordinate breaking changes — update `features.md`, notify affected
  Domain Agents through the Governor.
- Verify contract changes typecheck across the whole workspace before
  merging (`pnpm turbo run typecheck`).

### Does NOT do

- Implement runtime logic. `packages/contracts/` is types-only — no
  runtime dependencies in its `package.json`.
- Touch any domain implementation.

### Operating rules

- Every contract change is its own block (S or M, occasionally L).
- Breaking contract changes (renames, removed fields, changed semantics)
  are L-tier with a rollout plan and migration blocks per consumer.
- Contracts is a **single-writer bottleneck** — only one Contracts
  Agent active at a time. Acceptable because contract changes are small
  and infrequent.

---

## Database Agent

### Owns

- `infrastructure/db/migrations/**`
- `infrastructure/db/schema.sql` (canonical view, regenerated from
  migrations)
- `infrastructure/db/seeds/**` (dev/test seed data)
- Migration manifests.

### Responsibilities

- Author migrations from Domain Agent proposals.
- Verify each migration: forward, backward (or marked irreversible with
  justification), idempotent.
- Run migrations on dev / staging / prod (or define how CI does so).
- Enforce T1: every new application table has `tenant_id` (or is
  explicitly marked cross-tenant infrastructure with a `system_` prefix
  or in a documented allow-list).
- Author RLS policies on every tenant-scoped table.

### Does NOT do

- Touch domain-specific code (only the schema and migration files).
- Approve domain-level queries (those are domain concerns).

### Operating rules

- Migrations are append-only. Never edit a committed migration.
- Each migration is paired with up + down SQL (or down marked
  irreversible).
- Schema changes that break consumers are L-tier blocks with rollout
  plan (additive in step 1, consumers migrate in step 2, cleanup in
  step 3).
- T1 review: every migration verifies tenant scoping.
- **Single-writer bottleneck** — only one Database Agent active at a
  time.

---

## Frontend App Agent

### Owns

- `apps/web/**` — pages, routing, layout, query layer.

### Responsibilities

- Build pages, layouts, routing in `apps/web/`.
- Consume domain contracts via the HTTP / query layer.
- Accessibility, responsive design, performance.

### Does NOT do

- Touch backend domain logic.
- Define cross-domain contracts (Contracts Agent's job).
- Add new UI primitives directly in `apps/web/` — those land in
  `packages/ui-kit/` first.

### Operating rules

- React function components + hooks only.
- Follow `protocols/REACT.md`.
- New UI primitive: lands in `ui-kit/` first; then `apps/web/` consumes
  it.

---

## UI-Kit Agent

### Owns

- `packages/ui-kit/**` — design system primitives, theme, visualization
  wrappers.

### Responsibilities

- Maintain the design system: tokens, primitives, theme provider, chart
  wrappers.
- Accessibility on every primitive.

### Does NOT do

- Touch `apps/web/` page code.
- Touch backend domains.

### Operating rules

- New primitive: declared in `packages/ui-kit/src/components/<Name>/`
  with a unit test, an a11y check, and a story or visual reference.
- Parallel-friendly with every backend domain. Highly parallel-friendly
  with the Frontend App Agent (only contention is when both touch the
  same component, which the manifest can prevent).

---

## Backend App Agent

### Owns

- `apps/api/**` — HTTP server (Fastify / Hono / Express — TBD Phase 0),
  routing, middleware, dependency wiring.

### Responsibilities

- Boot the API server.
- Wire domain packages into HTTP endpoints (calls
  `packages/identity/index.ts`, `packages/tenancy/index.ts`, etc., via
  their public surface).
- Implement HTTP-layer concerns: rate limiting, idempotency, CORS,
  observability hooks.
- Generate OpenAPI from zod schemas.

### Does NOT do

- Implement domain logic — only orchestrates domain packages.
- Define cross-domain contracts.

### Operating rules

- Per-endpoint contracts live in `packages/contracts/src/<domain>/api.ts`
  (Contracts Agent defines types; Backend App Agent uses them).
- Follow `protocols/API.md`.

---

## Observability Agent

### Owns

- `packages/observability/**` — logger factory, metrics registry, trace
  span helpers.

### Responsibilities

- Provide standard observability primitives consumed by every other
  package.
- Maintain log / metric / span schemas.

### Does NOT do

- Choose log destinations (DevOps Agent decides per environment).
- Implement alerting (a Phase 3+ concern).

### Operating rules

- Leaf dependency. Parallel-friendly with everything.
- Public surface in `packages/observability/index.ts`. No deep imports
  from consumers.

---

## DevOps Agent

### Owns

- `infrastructure/ci/**` — GitHub Actions or equivalent.
- `infrastructure/deploy/**` — Dockerfiles, deployment configs.
- Root tooling: `pnpm-workspace.yaml`, `turbo.json`, root `package.json`,
  shared `tsconfig.base.json`, root `.eslintrc.cjs`.
- Secret management strategy.

### Responsibilities

- Maintain CI pipelines (typecheck + lint + test on PR; deploy on merge
  to `main`).
- Maintain deployment configs per environment (dev, staging, prod).
- Optimize build time, cache hit rate.
- Coordinate with Database Agent on migration deploy timing.

### Does NOT do

- Touch domain code.
- Decide product features.

### Operating rules

- Changes to CI/CD affecting all deploys are L-tier; targeted changes
  are M.
- New environment variables: declare in workspace config, document in
  `infrastructure/deploy/README.md`, communicate to Domain Agents
  through the Governor.

---

## Coordination signals

### Starting a session

1. Identify the role (Governor, Contracts, Database, or a Domain).
2. If a Domain Agent: confirm via `STATE.md` that the package is free.
3. Read `PROTOCOLS.md` (constitution, once per session).
4. Read `STATE.md` (cross-domain awareness, every session).
5. Read the active block manifest (`manifests/active/block-<NNN>-*.md`).
6. Read role-specific addenda from `protocols/*.md`.
7. Read the target package's `README.md` + (if exists) `STATE.md`.
8. Create the worktree branch (Domain / Contracts / Database / App
   agents).

### During work

- Stay within manifest scope.
- If a change needs another package's internals, stop. Either propose a
  contract change (Contracts Agent block) or split the work.
- If a schema change is needed, stop. Propose a migration (Database
  Agent block).
- If a UI primitive is missing, stop. Propose a `ui-kit/` block first.

### Finishing a block

1. Run validation per manifest (typecheck, lint, test, conditional
   bench).
2. Update package-local docs.
3. Set manifest `status:` to `Complete`.
4. Push the worktree branch.
5. Open the PR.
6. Notify the Governor session: "block-<NNN> ready for review."

### Integration (Governor only)

1. Run `governor preflight manifests/active/block-<NNN>-*.md` (schema
   validation + dep check + scope-conflict check).
2. Run `governor conflicts` to confirm no file-scope collision with
   other active blocks.
3. Run CI on the PR; verify green.
4. Run `governor integrate <repo> <branch> --dry-run`, present the
   plan to the user, then re-run without `--dry-run` on approval.
5. Update `STATE.md` (Governor edits by hand from the
   `STATE.proposed.md` derived view).
6. Archive the manifest from `manifests/active/` to
   `manifests/archive/`.
7. Update `features.md` if the block contributed to a cross-domain
   feature.

---

## Conflict resolution

### Two agents want the same package

**Prevention:** the single-writer rule. The Governor blocks a second
agent from starting in a package that's already active per `STATE.md`.

**If it happens anyway:** the first PR to merge wins. The second agent
rebases its worktree branch on the new `main` and continues, OR has its
block split into post-merge work.

### Contract conflict

Two PRs both modify `packages/contracts/` for different reasons:

- The Contracts Agent is the single owner. Only one Contracts session at
  a time.
- If two unrelated contract changes are needed, the Governor sequences
  them through the Contracts Agent across two blocks.

### Cross-package PR (rare)

A PR touching multiple packages is rare and L-tier. It's authored by the
Workspace Governor (or a designated coordinator agent) after explicit
approval. No other agent active in those packages during the work.

---

## Trust model

- The **Governor** is the most-trusted agent. It can read everything but
  mutates only the cognition layer + `.governor/`.
- **Domain Agents** are sandboxed to their package by D1 + ESLint's
  no-deep-imports rule. They cannot inadvertently break another domain
  because the package boundary prevents it.
- **Contracts** and **Database** are bottlenecks **by design** — they're
  slow paths that enforce consistency. Don't try to optimize them away;
  optimize *around* them with additive contract evolution.
- **Frontend App / UI-Kit** are the most parallel-friendly pair. UI
  iteration rarely conflicts with backend work once contracts are
  stable.

---

## How to add a new agent role

1. Open a Governor proposal in `.governor/proposals/<date>-<slug>.md`:
   role name, scope of ownership, responsibilities, what it can and
   cannot do.
2. Governor verifies the role doesn't overlap an existing one
   (single-writer per package; no shared ownership).
3. User approves.
4. Governor updates this file + `STATE.md` + `WORKSPACE_MAP.md` + the
   orchestrator config if the new role owns new paths.
5. Version bump on `AGENT_OPERATING_MODEL.md`.

Avoid creating roles for tasks an existing role can handle. The fewer
roles, the less coordination overhead.
