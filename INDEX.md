# Workspace Index

Navigation map for the cognitive layer. Tells agents what to read, when, and
why. The workspace uses **root-level cognition** (PROTOCOLS.md, STATE.md,
INDEX.md and supporting docs live at the workspace root, alongside
`packages/`, `apps/`, `.governor/`, and `orchestrator/`).

---

## HOT — read every session (~16 KB total)

| File | Purpose | Size cap |
|------|---------|----------|
| `PROTOCOLS.md` | Constitution: 18 axioms (P/Q/C/D/T) + Comment Charter + manifest tiers | 14 KB |
| `STATE.md` | Cross-domain current state (Governor SSoT) | 2 KB |
| `INDEX.md` | This file | 2 KB |

---

## WARM — for active work (loaded conditionally)

### Architectural reference (read once during onboarding; revisit when designing new packages)

| File | When |
|------|------|
| `COGNITIVE_ARCHITECTURE.md` | First session of any new agent role |
| `REPOSITORY_STRATEGY.md` | First session; or when adding new packages / apps |
| `DOMAIN_ARCHITECTURE.md` | Designing a new domain, or working at a domain boundary |
| `PARALLEL_IMPLEMENTATION.md` | First parallel work; or coordinating cross-package |
| `PHASE_PIPELINE.md` | At phase planning or phase exit |
| `AGENT_OPERATING_MODEL.md` | First session of any new agent role |
| `WORKSPACE_MAP.md` | Onboarding; or when a path layout question comes up |
| `features.md` | Working on a cross-domain feature |

### Language and domain addenda (load only what applies to current work)

| File | When |
|------|------|
| `protocols/TYPESCRIPT.md` | Any TS code (universal) |
| `protocols/REACT.md` | Working in `apps/web` or `packages/ui-kit` |
| `protocols/DATABASE.md` | Any schema or query work |
| `protocols/API.md` | Any HTTP / REST endpoint work |
| `protocols/TENANT.md` | Any code that touches tenant-scoped data (most code) |

### Active phase + manifests

| File | When |
|------|------|
| `phases/phase-<active>/roadmap.md` | Onboarding to current phase |
| `phases/phase-<active>/decisions.md` | When a design decision is questioned |
| `phases/phase-<active>/exit.md` | When approaching phase exit |
| `manifests/active/block-<id>.md` | When executing block `<id>` |

### Templates (read when creating)

| File | When |
|------|------|
| `templates/manifest-S.md` | Creating a spike / small block manifest |
| `templates/manifest-M.md` | Creating a standard block manifest |
| `templates/manifest-L.md` | Creating a gate or cross-domain block manifest |
| `templates/domain-doc.md` | Creating a new domain README |
| `templates/api-contract.md` | Defining a new HTTP endpoint contract |
| `templates/adr-template.md` | Writing an Architecture Decision Record |

### Orchestrator (Governor only)

| File | When |
|------|------|
| `orchestrator/README.md` | Onboarding the Governor; troubleshooting commands |
| `orchestrator.config.yaml` | Adjusting project-level orchestrator config |
| `.claude/skills/governor-*/SKILL.md` | Invoking a `/governor-<x>` slash command |

---

## COLD — never auto-loaded (forensics only)

| Path | Contents |
|------|----------|
| `phases/archive/**` | Completed phase folders |
| `manifests/archive/**` | Completed block manifests |
| `decisions/ADR-*.md` | Historical decisions (immutable; new ADRs append) |
| `governance/log.md` | Governor activity log (append-only) |
| `governance/audit-*.md` | Past audit reports (operational, regeneratable) |
| `.governor/proposals/**` | Past Governor proposals (approved or rejected) |
| `.governor/audits/**` | Pre-audit drafts and notes |
| `.governor/maps/**` | Per-package dependency maps |

---

## Per-package entry points

When working inside a package, the agent loads:

```
packages/<name>/
├── README.md       — package identity + public surface description
├── STATE.md        — local state (optional; not all packages need one)
├── package.json    — dependencies
├── tsconfig.json   — TS config
├── src/            — source
│   ├── index.ts    — public surface
│   └── ...
└── __tests__/      — tests
```

The package's `README.md` describes its purpose and public surface. The
`STATE.md` (if present) describes what the active block is changing. Not
every package needs a `STATE.md` — small or stable packages can rely on the
workspace `STATE.md`.

---

## Cognition file taxonomy (the constitution of this index)

| Class | Examples | Edit policy |
|-------|----------|-------------|
| **CANONICAL** | `PROTOCOLS.md`, `protocols/*.md`, `templates/*.md`, `orchestrator/**`, `orchestrator.config.yaml`, schemas | Governor proposal + user approval + version bump |
| **HOT** | `STATE.md`, `INDEX.md` | Edit-in-place; size caps enforced |
| **OPERATIONAL** | `manifests/active/*.md`, `manifests/archive/*.md`, `phases/<active>/**`, `governance/log.md`, `governance/audit-*.md` | Frozen-at-start (manifests) or append-only (logs) |
| **DERIVED** | `STATE.proposed.md`, `governance/dag.md`, `governance/overrides.md`, `governance/metrics.md`, `governance/churn-*.md`, `governance/conflicts.md`, `governance/preflight-*.md` | Regeneratable; carry source-hash footers |
| **TRANSIENT** | `.governor/orchestrator/.cache.json`, `.governor/orchestrator/.lock` | Never committed; regenerated on demand |
| **GOV-PRIVATE** | `.governor/audits/**`, `.governor/proposals/**`, `.governor/maps/**` | Governor-only; not read by implementation agents |

If a HOT file overruns its cap, the Governor flags it for refactor via an
audit finding (rule `04-hot-size-caps`).

---

## When the index is out of date

If a new HOT or WARM file is introduced, add it to the relevant section here.
The Governor verifies the index at every integration via audit rule
`03-index-pointers`; missing pointers generate an audit warning.

---

## How to add a new doc to this system

Before creating a doc, answer:

1. **What single fact does it own?** (If you can't answer this in one sentence, you don't need the doc.)
2. **What class?** (CANONICAL, HOT, OPERATIONAL, DERIVED, TRANSIENT, GOV-PRIVATE)
3. **What mutation pattern?** (edit, replace, append, frozen, regeneratable)
4. **Where does it live?** (Match the layout in `WORKSPACE_MAP.md`.)
5. **What's its size cap?** (HOT files only.)

Add the doc to this index with these properties declared. Governor reviews
before the doc is created.
