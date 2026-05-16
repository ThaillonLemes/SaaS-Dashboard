# Phase 0 — Foundation (roadmap)

_Frozen at phase start. Block list does not change once Phase 0 begins._
_Phase start date: 2026-05-15._
_Phase exit: see `exit.md`._

---

## Goal

Establish the monorepo, the cross-cutting tooling, and the package
skeletons that everything else depends on. After Phase 0 exits, Phases
1A through 1F unlock and run in parallel.

## Why sequential

If the foundation is wrong, parallel work has no substrate. Phase 0 is
the one mandatory single-active-agent phase. Per
[PHASE_PIPELINE.md:37](../../PHASE_PIPELINE.md:37), this is by design.

## Blocks

| # | ID | Tier | Domain | Purpose | Depends-on |
|--:|----|:----:|--------|---------|------------|
| 1 | `block-001-monorepo-skeleton` | M | infrastructure/monorepo | pnpm + turborepo + TS + ESLint + Prettier + root scripts | — |
| 2 | `block-002-postgres-baseline` | M | infrastructure/db | Postgres + ORM (ADR-0002) + docker-compose + migrations scaffold | 001 |
| 3 | `block-003-observability` | M | packages/observability | logger + metrics + tracing primitives | 001 |
| 4 | `block-004-contracts-skeleton` | M | packages/contracts | branded `TenantId`, `UserId` + `TenantContext` interface | 001 |
| 5 | `block-005-identity-skeleton` | M | packages/identity | package scaffold + public surface stubs | 001, 004 |
| 6 | `block-006-tenancy-skeleton` | M | packages/tenancy | package scaffold + `getTenantContext` signature | 001, 004 |
| 7 | `block-007-api-shell` | M | apps/api | HTTP shell with `/health` + ADR-0003 (Fastify/Hono/Express) | 001, 003 |
| 8 | `block-008-web-shell` | M | apps/web | Vite + React shell with login route stub | 001 |
| 9 | `block-009-ci-pipeline` | M | infrastructure/ci | GitHub Actions: typecheck + lint + test on PR + orchestrator hooks | 001 |
| 10 | `block-010-phase-0-exit-gate` | L | (phase gate) | Verify everything green; stamp `exit.md`; unlock Phase 1A-1F | 001-009 |

## Tier rationale

- Most blocks are Tier M — single-package implementation with low-to-medium risk.
- Block 010 is Tier L because it's a gate that touches every package and produces
  the `exit.md` artifact.
- No Tier S blocks in Phase 0 (the schema only permits `investigation` /
  `refactor` for S; everything in Phase 0 creates files).

## ADRs landing in Phase 0

| ADR | Title | Landed by |
|-----|-------|-----------|
| ADR-0001 | Monorepo + tool stack | Governor pre-Block-001 (this folder authoring) |
| ADR-0002 | Postgres + ORM choice | Block 002's agent (chosen during the block) |
| ADR-0003 | HTTP framework | Block 007's agent (chosen during the block) |
| ADR-0004 | Deploy: PaaS-first, portable | Governor pre-Block-001 (this folder authoring) |
| ADR-0005 | Billing: tier-based with usage caps | Governor pre-Block-001 (this folder authoring) |

ADR-0001 / 0004 / 0005 are Governor-authored architectural calls — pre-decided so
Block agents implement against a clear spec. ADR-0002 / 0003 are technology
choices best made by the agent that ships the first implementation; they're
deferred into their respective blocks.

## Parallelism inside Phase 0

None. Phase 0 runs one active agent at a time. Within-phase parallelism
is technically possible after Block 001 lands (e.g., 002 + 003 + 008
could run concurrently), but Phase 0 is short enough (~6-10 hours) that
serial execution keeps coordination overhead near zero.

## Estimated duration

~6-10 hours of active implementation across 10 blocks. Integration
overhead per block (review + PR merge + STATE.md update) is ~10 min.
Total wall-clock: 1-3 days depending on session cadence.

## Exit unlocks

After Block 010 stamps PASS:

- **Phase 1A** — Identity (auth, sessions)
- **Phase 1B** — Tenancy (lifecycle, roles, plan limits)
- **Phase 1C** — Integrations (CISSPoder connector — first ERP)
- **Phase 1D** — Normalization (canonical model + mapping)
- **Phase 1E** — Observability follow-ups (folded into Phase 0 Block 003 for the most part)
- **Phase 1F** — UI kit (design system)

Phases 1A-1F run in parallel, single-writer per package, coordinated via
`STATE.md`.
