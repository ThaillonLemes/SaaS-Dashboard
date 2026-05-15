# Workspace bootstrap (CLAUDE.md)

This is a **monorepo SaaS workspace** built for maximum safe parallelism.
The repository root contains:

- The **cognition layer** at the root: `PROTOCOLS.md`, `STATE.md`,
  `INDEX.md`, `COGNITIVE_ARCHITECTURE.md`, `REPOSITORY_STRATEGY.md`,
  `DOMAIN_ARCHITECTURE.md`, `PARALLEL_IMPLEMENTATION.md`,
  `PHASE_PIPELINE.md`, `AGENT_OPERATING_MODEL.md`, `WORKSPACE_MAP.md`,
  `features.md`.
- The **protocol addenda** at `protocols/*.md` (TypeScript, React,
  Database, API, Tenant).
- The **templates** at `templates/*.md`.
- The **orchestrator** at `orchestrator/` with `orchestrator.config.yaml`
  at the root.
- The **Governor private workspace** at `.governor/`.
- **Slash commands** at `.claude/skills/governor-*/SKILL.md`.

`apps/`, `packages/`, and `infrastructure/` are created by Phase 0
blocks. They do not exist in this skeleton.

---

## Pick your bootstrap by role

If your session is the **Workspace Governor** (default for a fresh session):

1. Read `PROTOCOLS.md` end to end (12-14 KB, once per session).
2. Read `STATE.md` (snapshot of cross-package work — possibly empty).
3. Read `INDEX.md` (navigation map).
4. Read `WORKSPACE_MAP.md` (path layout).
5. Read `COGNITIVE_ARCHITECTURE.md` + `AGENT_OPERATING_MODEL.md` +
   `PARALLEL_IMPLEMENTATION.md` if it's your first session in this repo.
6. Run `governor doctor` (via `/governor-doctor`) to verify the
   orchestrator is healthy.

If your session is a **Domain Agent / Contracts / Database / App agent**:

1. Read `PROTOCOLS.md` (once per session).
2. Read `STATE.md` to confirm your package is free.
3. Read the relevant addendum (`protocols/TYPESCRIPT.md` always;
   `protocols/DATABASE.md` if touching schema; etc.).
4. Read the block manifest you were assigned
   (`manifests/active/block-<NNN>-*.md`).
5. Read the target package's `README.md` and (optional) `STATE.md`.
6. Read the contracts you depend on
   (`packages/contracts/src/<domain>/*.ts`).
7. Create your worktree:
   `git worktree add .claude/worktrees/<domain>-<slug> -b agent/<domain>/block-<NNN>-<slug>`.
8. Work inside the worktree until validation passes.

---

## Mandatory pre-edit reading

NO edit to any file under `apps/**` or `packages/**` happens before the
agent has read:

1. `PROTOCOLS.md` (axioms + Comment Charter).
2. `protocols/TYPESCRIPT.md`.
3. The relevant addenda for the touched tech (DB, API, REACT, TENANT).
4. The block manifest authorizing the change.

This is a P6 (decisions on disk) and C2 (minimum diff) requirement.

---

## Priority hierarchy

When axioms or rules conflict, resolve in this order:

1. **Correctness** — P3 green tree, Q2 invariants, T1 tenant safety.
2. **Quality** — Q1 simplicity, Q3 names, Q4 locality.
3. **Consistency** — C1 mirror, C2 minimum diff, C3 one way, C4 no debris.
4. **Token efficiency** — everything else.

Quality and consistency rank above tokens.

---

## Slash commands surface

The Governor session has access to 11 `/governor-*` slash commands
defined in `.claude/skills/governor-*/SKILL.md`. They wrap the
orchestrator CLI. List:

- `/governor-doctor` — health check
- `/governor-state` — refresh cross-package state proposal
- `/governor-next` — compute DAG of pending manifests
- `/governor-conflicts` — file-scope collisions
- `/governor-preflight` — validate a manifest before block start
- `/governor-audit` — run all 13 audit rules
- `/governor-integrate` — transactional merge of a worktree branch
- `/governor-undo` — reverse the latest (or named) transaction
- `/governor-metrics` — aggregate audit + integration + manifest signals
- `/governor-churn` — top-N modified files per package
- `/governor-ownership` — who can edit which file

Use them in preference to invoking `npx tsx orchestrator/bin/governor.ts`
manually. They handle path resolution, report generation, and follow-up
file reads for you.
