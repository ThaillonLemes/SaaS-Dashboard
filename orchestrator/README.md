# SaaS Workspace Orchestrator

**Status:** v3.3 — full orchestrator shipped (telemetry + capability hook + 11 skills).

The orchestrator is a deterministic, read-only-on-canonical CLI that
derives state, conflicts, DAG, and audit views from the workspace's
canonical markdown. It runs on demand or via git hooks. No daemon, no
database.

The binary is **project-agnostic** — all project-specific facts live in
`../orchestrator.config.yaml` at the workspace root. MMORPG ships a
different config with the same schema. To port this orchestrator to
another workspace, only the config changes.

---

## What's here

```
orchestrator/
├── README.md                              this file
├── package.json                           tsx-based runtime, no build step
├── tsconfig.json                          NodeNext ESM, strict
├── bin/
│   └── governor.ts                        CLI dispatcher
├── src/
│   ├── paths.ts                           workspace-root discovery
│   ├── config.ts                          orchestrator.config.yaml loader
│   ├── lock.ts                            .lock with 30s wait + stale recovery
│   ├── git.ts                             git CLI wrappers (worktrees, HEAD, log)
│   ├── workspace.ts                       repo view + manifest enumeration
│   ├── footer.ts                          source-hash footer for DERIVED files
│   ├── ledger.ts                          transaction ledger skeleton (Wave 2 uses)
│   ├── manifest/
│   │   ├── parse.ts                       YAML frontmatter parser
│   │   └── validate.ts                    Ajv 2020-12 validator
│   ├── audit/                             Wave 2 Session 1
│   │   ├── types.ts                       rule + finding + handler types
│   │   ├── engine.ts                      rule loader + executor + report renderer
│   │   ├── handlers.ts                    13 rule handler implementations
│   │   └── template.ts                    audit-template HTML-header loader
│   └── commands/
│       ├── scan.ts                        Wave 1
│       ├── state.ts                       Wave 1
│       ├── next.ts                        Wave 1
│       ├── conflicts.ts                   Wave 1
│       ├── doctor.ts                      Wave 1
│       ├── verify.ts                      Wave 1
│       ├── audit.ts                       Wave 2 Session 1
│       ├── preflight.ts                   Wave 2 Session 2
│       ├── integrate.ts                   Wave 2 Session 2
│       ├── undo.ts                        Wave 2 Session 2
│       ├── metrics.ts                     Wave 3
│       ├── churn.ts                       Wave 3
│       └── ownership.ts                   Wave 3
├── schemas/
│   ├── manifest-S.schema.yaml             Wave 0
│   ├── manifest-M.schema.yaml             Wave 0
│   └── manifest-L.schema.yaml             Wave 0
├── audit-rules/                           13 deterministic audit rules
│   ├── 00-comment-tier-d.yaml             Q3 — forbidden patterns
│   ├── 01-comment-density.yaml            Q3 — density cap
│   ├── 02-stale-docs.yaml                 P6 — staleness
│   ├── 03-index-pointers.yaml             SSoT — broken links
│   ├── 04-hot-size-caps.yaml              bounded cognition
│   ├── 05-override-regen.yaml             derivation: overrides.md
│   ├── 06-orchestrator-config.yaml        config drift
│   ├── 07-concurrent-blocks.yaml          single-writer rule
│   ├── 08-manifest-age.yaml               age + P3
│   ├── 09-file-scope-cap.yaml             tier discipline
│   ├── 10-manual-edit-derived.yaml        trust model
│   ├── 11-ownership-violations.yaml       ownership
│   └── 12-bootstrap-integrity.yaml        template-driven
├── ci/
│   ├── audit.sh                           CI wrapper (warn-only)
│   ├── github-actions-audit.yml           workflow template
│   └── README.md                          install + flip instructions
└── hooks/
    ├── pre-commit-manifest.sh             frontmatter check
    ├── pre-commit-capability.sh           scope warn (warn-only)
    ├── post-commit-scan.sh                refresh .cache.json (non-blocking)
    └── install.md                         install instructions
```

---

## Usage

```bash
cd orchestrator
npm install            # first time only
npx tsx bin/governor.ts <command>
```

Or via the `governor` package script:

```bash
npm run -s governor -- <command>
```

### Commands

| Command | Output |
|---------|--------|
| `governor scan` | `.governor/orchestrator/.cache.json` (TRANSIENT) |
| `governor state` | `STATE.proposed.md` (DERIVED) |
| `governor next` | `governance/dag.md` (DERIVED) |
| `governor conflicts` | `governance/conflicts.md` (OPERATIONAL) |
| `governor doctor` | stdout PASS/FAIL summary |
| `governor verify <path>` | stdout per-source hash diff |
| `governor audit [--only IDS]` | `governance/audit-<date>.md` + regen `overrides.md` |
| `governor preflight <manifest>` | `governance/preflight-<block-id>.md` (OPERATIONAL) |
| `governor integrate <repo> <branch> [--dry-run]` | Transactional merge + manifest archival + ledger entry |
| `governor undo [<txn-id>]` | Reverses latest (or named) transaction |
| `governor metrics` | `governance/metrics.md` (DERIVED) |
| `governor churn <package> [--top N] [--since-days N]` | `governance/churn-<package>.md` (DERIVED) |
| `governor ownership <path>` | stdout — editor + trust class + active claims |

`STATE.proposed.md` is **never** auto-promoted to `STATE.md`. The Governor
reads the proposed file, decides, and edits `STATE.md` by hand per Q4.

The CLI runs from the `orchestrator/` directory but resolves paths
relative to the workspace root (where `orchestrator.config.yaml` lives).
The 11 governor-* slash commands in `.claude/skills/` are the
recommended Governor interface.

---

## What's NOT here yet

All v3 features (scan, state, next, conflicts, doctor, verify, audit,
preflight, integrate, undo, metrics, churn, ownership) are shipped.
Conditional future additions:

- TypeScript-specific dep extractor — trigger: audit reveals ≥ 3
  manifest/code dep-drift findings.
- MCP server wrapping the CLI — trigger: the 11 slash commands feel
  insufficient and the user wants programmatic agent access.
- Semantic index — trigger: corpus > 1000 docs OR
  `governance/search-misses.md` records 3+ documented misses in a
  month.

---

## File classes

| Path | Class | Edit policy |
|------|-------|-------------|
| `schemas/*.schema.yaml` | CANONICAL | Governor proposal only |
| `audit-rules/*.yaml` | CANONICAL | Governor proposal only |
| `ci/audit.sh`, `ci/github-actions-audit.yml` | CANONICAL | Governor proposal only |
| `ci/README.md` | OPERATIONAL | edit-in-place |
| `hooks/*.sh` | CANONICAL | Governor proposal only |
| `hooks/install.md` | OPERATIONAL | edit-in-place |
| `bin/`, `src/`, `package.json`, `tsconfig.json` | CANONICAL | Governor proposal only |
| `../orchestrator.config.yaml` | CANONICAL | Governor proposal only |
| `../.governor/orchestrator/.cache.json` | TRANSIENT | regenerable, never committed |
| `../.governor/orchestrator/.lock` | TRANSIENT | regenerable, never committed |
| `../.governor/orchestrator/transactions/*.json` | OPERATIONAL | append-only |
| `../STATE.proposed.md` | DERIVED | regenerable |
| `../governance/dag.md` | DERIVED | regenerable |
| `../governance/conflicts.md` | OPERATIONAL | regenerable |
| `../governance/overrides.md` | DERIVED | regenerated by audit rule 05 |
| `../governance/overrides.canonical-snapshot.md` | CANONICAL | frozen pre-Wave-2 snapshot |
| `../governance/audit-<date>.md` | OPERATIONAL | regenerable |
| `../governance/preflight-<block-id>.md` | OPERATIONAL | regenerable |
| `../governance/metrics.md` | DERIVED | regenerable |
| `../governance/churn-<repo>.md` | DERIVED | regenerable |
| `../.claude/skills/governor-*/SKILL.md` | CANONICAL | Governor proposal only |

See `INDEX.md` §"Cognition file taxonomy" for the canonical taxonomy.

---

## Determinism

Every DERIVED artifact carries a footer:

```
<!-- generator: governor <command> @ <ISO timestamp> -->
<!-- sources:
<!--   <relative path>  <sha256>
<!-- end:sources -->
```

`governor verify <path>` re-hashes the sources and reports STALE or
UNCHANGED. Same inputs → byte-identical output (modulo the timestamp line).

---

## Cross-project intent

The orchestrator binary is project-agnostic. All project-specific facts
live in `../orchestrator.config.yaml`. To port to another workspace,
only the config changes.
