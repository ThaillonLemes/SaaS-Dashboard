# Cognitive Architecture

How the workspace organizes knowledge so AI agents can navigate it cheaply,
work in parallel safely, and stay consistent over years.

---

## Three principles

### 1. Single source of truth per fact

Every fact lives in exactly one file. Other docs reference, never duplicate.

Why: duplication is the #1 source of drift. When the same fact lives in three
files, two of them go stale silently. Years of small drifts compound into
incoherent cognition.

Practical example: cross-domain state lives only in `STATE.md`. A package's
README does NOT restate cross-domain state — it points to `STATE.md`.

### 2. Hot / Warm / Cold separation

- **HOT**: required at every session start. Tight token budget (≤5 KB total at workspace level).
- **WARM**: required for the *current* block. Loaded conditionally.
- **COLD**: historical, archival. Read only for forensics; never bootstrap-loaded.

Why: agents have limited context windows. Bootstrap should fit in <5k tokens
so the remaining budget goes to the actual work.

### 3. Inheritance over copy

Shared content lives upstream. Downstream files point upstream rather than
copying.

Practical example: methodology (axioms, manifest format, lifecycle) lives in
`./PROTOCOLS.md`. Per-package READMEs do NOT restate methodology —
they say "see `./PROTOCOLS.md`".

---

## File layout (cognitive layer only)

The cognitive layer is the `./` folder. It mirrors no specific code
package — it's the workspace's brain.

```
./
├── PROTOCOLS.md                ← constitution (axioms, Charter, manifest tiers)
├── COGNITIVE_ARCHITECTURE.md   ← this file
├── REPOSITORY_STRATEGY.md      ← monorepo decision + layout
├── DOMAIN_ARCHITECTURE.md      ← bounded contexts
├── PARALLEL_IMPLEMENTATION.md  ← concurrent work strategy
├── PHASE_PIPELINE.md           ← phases, blocks, DAG
├── AGENT_OPERATING_MODEL.md    ← agent roles
├── INDEX.md                    ← navigation map (HOT/WARM/COLD)
├── STATE.md                    ← cross-domain state (Governor-maintained SSoT)
├── features.md                 ← cross-domain features (Governor-maintained)
├── phases/
│   └── phase-<name>/           ← per-phase folder
│       ├── roadmap.md
│       ├── decisions.md
│       └── exit.md
├── manifests/
│   ├── active/                 ← in-flight blocks
│   └── archive/                ← completed blocks
├── protocols/                  ← language and domain addenda
│   ├── TYPESCRIPT.md
│   ├── REACT.md
│   ├── DATABASE.md
│   ├── API.md
│   └── TENANT.md
├── templates/
│   ├── manifest-S.md
│   ├── manifest-M.md
│   ├── manifest-L.md
│   ├── domain-doc.md
│   ├── api-contract.md
│   └── adr-template.md
├── decisions/                  ← ADRs (Architecture Decision Records)
│   ├── ADR-0001-monorepo.md
│   ├── ADR-0002-postgres.md
│   └── ...
└── governance/
    ├── overrides.md            ← axiom override dashboard
    └── log.md                  ← Governor activity log
```

---

## What lives where (SSoT table — the constitution made explicit)

| Fact | Source of truth | Read by |
|------|-----------------|---------|
| What this project is | `./README.md` *(optional)* + `apps/web/README.md` | every session |
| What's happening across domains right now | `./STATE.md` | every session |
| How blocks work (methodology) | `./PROTOCOLS.md` | every session (once) |
| Repo layout decision + rationale | `./REPOSITORY_STRATEGY.md` | onboarding |
| Bounded contexts | `./DOMAIN_ARCHITECTURE.md` | onboarding + when designing new packages |
| Phase plans | `./phases/phase-<name>/roadmap.md` | only when that phase is active |
| Block contracts | `./manifests/active/block-<id>.md` | only when working on that block |
| Public package interface | `packages/<name>/index.ts` + types in `packages/contracts/` | every consumer |
| Cross-domain features | `./features.md` | when working on a feature |
| Historical decisions | `./decisions/ADR-NNNN-*.md` | when relevant to current work |
| Branching / git workflow | `./REPOSITORY_STRATEGY.md` (or its own doc) | onboarding |
| Per-language rules | `./protocols/*.md` | when working in that language |

If a new doc is needed, its column ("source of truth for X") must be declared
before it's created. No doc exists without a clear ownership of facts.

---

## Bootstrap sequence (per session)

When an agent starts a session, it reads files in this order:

```
1. ./PROTOCOLS.md        — constitution + axioms (≤8 KB, once)
2. ./STATE.md            — cross-domain state (≤1 KB)
3. ./INDEX.md            — navigation (≤2 KB)
4. <task-specific>:
   - If implementing in package X: packages/X/README.md + packages/X/STATE.md (if exists)
   - If working in TypeScript: ./protocols/TYPESCRIPT.md
   - If touching React: ./protocols/REACT.md
   - If touching DB: ./protocols/DATABASE.md
   - If touching API: ./protocols/API.md
   - Block manifest: ./manifests/active/block-<id>.md
```

Total bootstrap budget: **~10-15 KB** depending on task. Compared to a
greenfield "read the whole repo" approach (often 50-100 KB), this is a 5-10×
reduction.

---

## Hot / Warm / Cold classification (file by file)

| Tier | File | Size cap | Mutation pattern |
|------|------|----------|------------------|
| HOT | `./PROTOCOLS.md` | 10 KB | edit-in-place (rare, proposal-gated) |
| HOT | `./STATE.md` | 2 KB | replace (per integration) |
| HOT | `./INDEX.md` | 2 KB | edit-in-place |
| WARM | `./features.md` | 5 KB | edit-in-place |
| WARM | `./DOMAIN_ARCHITECTURE.md` | 5 KB | edit-in-place (rare) |
| WARM | `./protocols/*.md` | 4 KB each | edit-in-place |
| WARM | `./phases/<active>/*.md` | 10 KB total | edit-in-place during phase |
| WARM | `./manifests/active/*.md` | 5 KB each | frozen at block start |
| WARM | `packages/<x>/README.md` | 3 KB | edit-in-place |
| WARM | `packages/<x>/STATE.md` (if exists) | 1 KB | replace |
| COLD | `./phases/archive/**` | unbounded | never edited after archival |
| COLD | `./manifests/archive/**` | unbounded | frozen |
| COLD | `./decisions/ADR-*.md` | unbounded | append-only (new ADRs; old ones are immutable) |
| GOV | `./governance/**` | unbounded | Governor only |

If a HOT file overruns its cap, the Governor flags it for refactor.

---

## State propagation

Cross-domain state (`STATE.md`) updates only via the Governor.

Per-domain state lives in the domain's own files. When a domain agent
finishes a block:

1. Updates its own package's local state (e.g., `packages/<x>/STATE.md` if it exists, or the relevant local docs).
2. Records the block outcome in its manifest's Status field.
3. Commits + pushes.

When the user signals "integrate":

1. Governor reads each domain's recent commits + local state.
2. Governor updates `./STATE.md` with the consolidated picture.
3. Governor merges PR(s).
4. Governor records the integration in `./governance/log.md`.

**Domain agents never write `./STATE.md` directly.** This rule
prevents the cross-domain drift class.

---

## How to add a new doc to this system

Before creating a doc, answer:

1. **What single fact does it own?** (If you can't answer this in one sentence, you don't need the doc.)
2. **What tier?** (HOT, WARM, COLD, GOV)
3. **What mutation pattern?** (edit, replace, append, frozen)
4. **Where does it live?** (Match the layout above.)
5. **What's its size cap?**

Add the doc to `INDEX.md` with these properties declared. Governor reviews
before the doc is created.

---

## Anti-patterns (explicit rejections)

These have been considered and rejected:

- **Wiki-style documentation hub** — too many click-throughs, drift-prone, hard for agents to index efficiently.
- **Auto-generated docs from code** — generates noise; the doc and code drift independently when code evolves.
- **README-only architecture** — README is identity, not state. State files exist precisely so READMEs don't have to track mutable content.
- **Centralized state.json or state.yaml** — markdown wins because agents read it natively; structured state files end up requiring tooling to parse.
- **Multiple "current state" files per repo** — exactly one `STATE.md` at workspace; optionally one per package. No more.
