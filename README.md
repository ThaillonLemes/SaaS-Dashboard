# SaaS V3 Workspace Package

A complete AI-native cognitive architecture, governance system, and CLI
orchestrator for a multi-tenant SaaS analytics/dashboard platform.
Designed for **maximum safe parallel AI implementation** — up to ~9
Claude Code sessions running concurrently after Phase 0.

**This is a cut-and-paste package.** The contents of this folder become
the root of your fresh git repository. After copying, start a Claude
Code session at the repo root and paste `INIT_PROMPT.md` as the first
message. The Governor agent reads itself in and proposes Phase 0.

---

## What's in the box

```
<root>/
├── README.md                       ← you are here
├── INIT_PROMPT.md                  ← paste into a new Claude Code session
├── CLAUDE.md                       ← workspace bootstrap (loaded automatically)
│
├── PROTOCOLS.md                    ← constitution: 18 axioms (P/Q/C/D/T)
├── STATE.md                        ← cross-package state (Governor SSoT)
├── INDEX.md                        ← navigation map (HOT / WARM / COLD)
├── COGNITIVE_ARCHITECTURE.md       ← how cognition is organized
├── REPOSITORY_STRATEGY.md          ← monorepo decision + layout
├── DOMAIN_ARCHITECTURE.md          ← bounded contexts (packages)
├── PARALLEL_IMPLEMENTATION.md      ← how ~9 agents run concurrently
├── PHASE_PIPELINE.md               ← phases as DAG, not linear
├── AGENT_OPERATING_MODEL.md        ← 14 agent roles + worktree convention
├── WORKSPACE_MAP.md                ← path layout reference
├── features.md                     ← cross-domain feature index (template)
│
├── protocols/                      ← language + domain addenda
│   ├── TYPESCRIPT.md
│   ├── REACT.md
│   ├── DATABASE.md
│   ├── API.md
│   └── TENANT.md
│
├── templates/                      ← reusable templates
│   ├── manifest-S.md               ← spike / small block
│   ├── manifest-M.md               ← standard block
│   ├── manifest-L.md               ← gate / cross-domain block
│   ├── domain-doc.md               ← new package README
│   ├── api-contract.md             ← HTTP endpoint contract
│   └── adr-template.md             ← ADR template
│
├── manifests/active/               ← in-flight block manifests (empty)
├── manifests/archive/              ← completed manifests (empty)
├── phases/                         ← per-phase folders (empty)
├── decisions/                      ← ADRs (empty)
│
├── governance/                     ← Governor-facing OPERATIONAL + DERIVED
│   ├── overrides.md                ← axiom override dashboard
│   └── log.md                      ← Governor activity log (append-only)
│
├── orchestrator/                   ← project-agnostic CLI (~3900 LOC TS)
│   ├── README.md                   ← orchestrator architecture
│   ├── package.json
│   ├── tsconfig.json
│   ├── bin/governor.ts             ← CLI entry
│   ├── src/                        ← TS source
│   ├── schemas/                    ← manifest JSON Schemas (S/M/L)
│   ├── audit-rules/                ← 13 deterministic audit rules
│   ├── hooks/                      ← pre-commit + post-commit hooks
│   └── ci/                         ← GitHub Actions audit template
│
├── orchestrator.config.yaml        ← project-specific orchestrator config
│
├── .governor/                      ← Governor private workspace
│   ├── README.md
│   ├── log.md
│   ├── audits/                     ← pre-audit drafts
│   ├── proposals/                  ← cognition-layer change proposals
│   ├── maps/                       ← per-package dep maps (optional)
│   └── orchestrator/               ← runtime state (cache, lock, transactions)
│
└── .claude/skills/                 ← 11 /governor-* slash commands
    ├── governor-audit/SKILL.md
    ├── governor-churn/SKILL.md
    ├── governor-conflicts/SKILL.md
    ├── governor-doctor/SKILL.md
    ├── governor-integrate/SKILL.md
    ├── governor-metrics/SKILL.md
    ├── governor-next/SKILL.md
    ├── governor-ownership/SKILL.md
    ├── governor-preflight/SKILL.md
    ├── governor-state/SKILL.md
    └── governor-undo/SKILL.md
```

`apps/`, `packages/`, and `infrastructure/` are NOT in the box — Phase 0
creates them.

---

## How to use this package

1. **Cut** the contents of this folder into your fresh repository root.
   (Move the *contents*, not the folder itself — i.e., end up with
   `<repo-root>/PROTOCOLS.md`, not `<repo-root>/_saas-foundation/PROTOCOLS.md`.)
2. **Initialize git** if you haven't: `git init && git add . && git commit -m "chore: install v3 workspace"`.
3. **Install orchestrator deps:** `cd orchestrator && npm install`.
4. **Verify bootability:** `cd orchestrator && npx tsx bin/governor.ts doctor`. Should print "PASS".
5. **Optional — install hooks:** `bash orchestrator/hooks/install.md` (read first; it's a manual setup).
6. **Open Claude Code at the repo root.** The session is the Governor.
7. **Paste the contents of `INIT_PROMPT.md`** as your first message.
8. The Governor reads the workspace, runs doctor, then proposes Phase 0
   blocks for your approval.

---

## Renaming the project (optional but recommended)

The package uses `@app/*` as the pnpm scope (e.g.,
`@app/identity`, `@app/contracts`) and `project.name: saas` in
`orchestrator.config.yaml`. To rebrand:

1. Pick a name (e.g., `acme`).
2. In `orchestrator.config.yaml`, change `project.name: saas` to
   `project.name: acme`.
3. In Phase 0 Block 001 (which the Governor will propose), the
   monorepo skeleton uses `@acme/*` scope from the start. No mass
   find-and-replace needed because Phase 0 hasn't created the
   `package.json` files yet.

If you don't rename, `@app/*` works fine — it's a placeholder scope
that doesn't conflict with anything published on npm under the same
name.

---

## Core principles (30-second summary)

- **Quality > Consistency > Token efficiency.** Resolve conflicts in that order.
- **Domain isolation is sacred.** Bounded contexts communicate only through
  published contracts. No reaching into another package's internals (D1).
- **Tenant safety is non-negotiable.** Every query, every operation, every
  persisted entity carries a tenant scope (T1).
- **Parallel by default.** Phase 0 is sequential. Everything after is a
  DAG — up to ~9 agents work concurrently.
- **Single source of truth per fact.** Every fact lives in exactly one
  file. No duplication.
- **The Governor is the gardener.** One agent owns cross-package
  coordination. Package agents own their packages. No cross-ownership.

---

## What's intentionally absent (and why)

This package does **not** include:

- **A specific UI design system.** Phase 1F deliverable.
- **Specific ERP integration code.** Phase 1C deliverable.
- **Specific KPI / analytics formulas.** Phase 2 deliverable.
- **Specific tenant pricing / billing plans.** Business logic, not foundation.
- **Hard-coded library choices** beyond TypeScript + PostgreSQL + Redis +
  pnpm + turborepo. Library decisions (Drizzle vs. Kysely, Fastify vs.
  Hono, etc.) belong to Phase 0 ADRs.

---

## Lineage and reuse

The orchestrator is **project-agnostic**. It originated in a battle-tested
MMORPG workspace and was promoted into a reusable package. The only
project-specific surface is `orchestrator.config.yaml`. If you spin up a
third workspace later (e.g., a CLI tool, a research project), copy the
`orchestrator/` directory and write a new config — no code changes.

This SaaS package optimizes for **parallel implementation throughput and
domain isolation** while preserving the quality and consistency
discipline of the original MMORPG architecture. Where MMORPG used
sequential validation gates and runtime-correctness ceremony, this
package trades that for higher-throughput parallel work — because in a
SaaS, domain isolation (D1/D2/T1) carries the safety load that, in a
game engine, the runtime invariants carry.

If you find an axiom or rule too strict for your reality, that's the
override clause's job — see `PROTOCOLS.md` § "The override clause".
