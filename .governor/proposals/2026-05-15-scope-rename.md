# Proposal: scope rename `@app/` → `@saas/`

- **Date:** 2026-05-15
- **Author:** Workspace Governor (this session)
- **Status:** Pending user approval
- **Affects:** CANONICAL files (cognition layer, protocols, templates, orchestrator manifest)
- **Risk:** Low (no implementation exists yet; pure documentation + one `package.json` field)

---

## Background

The cognition layer ships with `@app/*` as a placeholder pnpm scope (see
[README.md:115-131](../../README.md:115)). Bootstrap question 1 settled the
real scope: **`@saas/`**. The rename must land before Phase 0 Block 001
because the monorepo skeleton it creates will set the scope across every
new `package.json` and ESLint `no-restricted-imports` pattern. Doing the
sweep now keeps Block 001's diff minimal (C2) and means no follow-up
clean-up block.

Per [PROTOCOLS.md:4](../../PROTOCOLS.md:4), CANONICAL file changes
require: Governor proposal → user approval → version bump → entry in
`governance/log.md`. This file is the proposal.

---

## What changes

Every occurrence of `@app/` becomes `@saas/`. 24 string sites across 13
source files, plus an auto-regenerated lockfile.

### Cognition layer (CANONICAL)

| File | Line(s) | Context |
|------|--------|---------|
| `PROTOCOLS.md` | 167, 168 | D1 example imports (`@app/contracts`, `@app/identity/src/cache`) |
| `REPOSITORY_STRATEGY.md` | 100, 101, 116, 117, 156 | package rules + naming conventions + turbo example |
| `PARALLEL_IMPLEMENTATION.md` | 21, 236 | ESLint pattern + anti-pattern example |
| `PHASE_PIPELINE.md` | 249 | dependencies declaration example |
| `README.md` | 117-131 | rewrite the "Renaming the project" section to record the rename is done |

### Protocol addenda (CANONICAL)

| File | Line(s) | Context |
|------|--------|---------|
| `protocols/TYPESCRIPT.md` | 122, 205 | path alias docs + workspace dep example |
| `protocols/TENANT.md` | 134 | observability import example |
| `protocols/DATABASE.md` | 167 | observability import example |

### Templates (CANONICAL)

| File | Line(s) | Context |
|------|--------|---------|
| `templates/manifest-M.md` | 31, 71 | contract dependency syntax + example |
| `templates/domain-doc.md` | 69, 70, 71, 89, 99 | dependency list + cross-domain return type + test command |
| `templates/api-contract.md` | 131 | TS import example |

### Orchestrator (CANONICAL)

| File | Line(s) | Context |
|------|--------|---------|
| `orchestrator/package.json` | 2 | `"name": "@app/orchestrator"` → `"name": "@saas/orchestrator"` |
| `orchestrator/schemas/manifest-M.schema.yaml` | 152 | description-field example |
| `orchestrator/package-lock.json` | 2, 8 | auto-regenerates on next `npm install`; not edited by hand |

---

## What does NOT change

- `orchestrator.config.yaml` already carries `project.name: saas` — no
  edit needed.
- No package-name string lives in any `.governor/`, `governance/`,
  `manifests/`, `phases/`, `decisions/`, `STATE.md`, `INDEX.md`,
  `WORKSPACE_MAP.md`, `COGNITIVE_ARCHITECTURE.md`,
  `DOMAIN_ARCHITECTURE.md`, `AGENT_OPERATING_MODEL.md`, `features.md`,
  or `CLAUDE.md` (grep-verified).
- `orchestrator/README.md` does not reference the package scope.

---

## Version bumps

Only `PROTOCOLS.md` carries an explicit `Version:` field and a
`Version history` section. Per the convention there, this proposal bumps
it to **v3** with a new history entry:

> **v3 — scope rename (2026-05-15)** — Replaced placeholder `@app/`
> scope with the project's chosen scope `@saas/` across cognition,
> protocols, templates, and `orchestrator/package.json`. Pre-Phase-0;
> no implementation consumers existed. Proposal:
> `.governor/proposals/2026-05-15-scope-rename.md`.

I will also fix a pre-existing inconsistency: the `Version: 1` header
field will be set to `Version: 3` to match the history (it was left at
`1` when v2 landed — see history entries dated 2026-05-14 and
2026-05-15).

Other CANONICAL files do not carry per-file version fields; their
edit is recorded by the `governance/log.md` entry below.

---

## Validation plan (after apply)

1. `grep -r "@app/" .` returns only `orchestrator/package-lock.json`
   (auto-regenerated).
2. `cd orchestrator && npm install && npx tsx bin/governor.ts doctor`
   → PASS 10/10.
3. `cd orchestrator && npm install` regenerates the lockfile with the
   new package name.

---

## Log entries on approval

**`governance/log.md`** (public — append):

```markdown
## 2026-05-15 — Scope rename @app/ → @saas/

- **Action:** Rebranded placeholder pnpm scope from @app/ to @saas/
  across cognition, protocols, templates, and orchestrator package.
- **Inputs:** Proposal .governor/proposals/2026-05-15-scope-rename.md;
  user approval recorded in chat (2026-05-15).
- **Outputs:** Edited 13 files (24 string sites); bumped PROTOCOLS.md
  to v3 with history entry; regenerated orchestrator/package-lock.json
  via npm install.
- **Notes:** Pre-Phase-0 rename — no implementation consumers existed,
  so no migration block needed. Doctor: PASS 10/10 post-rename.
```

**`.governor/log.md`** (private — same entry, plus operator notes).

---

## Decision requested

Approve, request changes, or reject.

On approval I will:

1. Apply all 24 string edits.
2. Bump `PROTOCOLS.md` version field to v3 and append history entry.
3. Rewrite the `README.md` "Renaming the project" section to a
   short note that the rename was applied.
4. Run `cd orchestrator && npm install` to regenerate the lockfile.
5. Run `npx tsx bin/governor.ts doctor` to verify PASS.
6. Append the entries above to `governance/log.md` and
   `.governor/log.md`.
7. Continue to Phase 0 authoring (proposal lives in `.governor/proposals/`
   permanently as historical record).
