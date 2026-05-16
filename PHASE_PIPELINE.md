# Phase Pipeline

How implementation progresses over time. Unlike heavy sequential pipelines,
this one is a **DAG** — most phases run in parallel after Phase 0.

---

## The pipeline at a glance

```
Phase 0 — Foundation (SEQUENTIAL, single bottleneck)
       │
       └──→ unlocks every domain
              │
       ┌──────┼──────┬──────┬──────┬──────┐
       ▼      ▼      ▼      ▼      ▼      ▼
   Phase    Phase  Phase  Phase  Phase  Phase
   1A       1B     1C     1D     1E     1F        ← parallel domain phases
   (Identity)(Tenancy)(Integrations)(Normalization)(Observability)(UI-kit)
       │      │      │      │      │      │
       └──────┴──┬───┴──────┴──────┴──────┘
                ▼
         Phase 2 — Composition (Analytics, Dashboard)
                │
                ▼
         Phase 3 — Productization (Billing, Notifications, Audit)
                │
                ▼
         Phase 4+ — Iteration waves (features, optimizations)
```

Phase 0 is the only mandatory sequential phase. Everything after is a DAG;
many domain phases run concurrently across separate AI agent sessions.

---

## Phase 0 — Foundation (sequential)

**Goal:** establish the monorepo, the core tooling, and the cross-cutting
packages that everything else depends on.

**Why sequential:** if Phase 0 isn't done correctly, parallel work has no
substrate. The whole point of P0 is to *enable* parallelism after.

**Blocks (proposed):**

| Block | Domain | Tier | Purpose |
|-------|--------|------|---------|
| 001 | repo root | M | Monorepo skeleton (pnpm, turborepo, TS config, ESLint) |
| 002 | infrastructure/db | M | Postgres baseline + migration tooling (e.g., `drizzle-kit` or `prisma migrate`) |
| 003 | packages/observability | M | Logger, metrics, tracing primitives |
| 004 | packages/contracts | S | Empty contracts package; `index.ts` placeholder + types for `TenantId`, `UserId` |
| 005 | packages/identity | M | Skeleton: package structure, public surface in `index.ts`, NO impl |
| 006 | packages/tenancy | M | Skeleton: package structure, `TenantContext` type, NO impl |
| 007 | apps/api | M | Express/Fastify/Hono app shell with `/health` endpoint, observability wired |
| 008 | apps/web | M | Vite + React app shell with login route stub |
| 009 | infrastructure/ci | M | GitHub Actions workflow (typecheck + lint + test on PR) |
| 010 | Phase 0 exit gate | L | Verify all of the above; stamp `exit.md`; unlock Phase 1A-1F |

**Estimated duration:** 1 active agent at a time. Each block ~30-60 min of AI
implementation + integration. Total ~6-10 hours sequential.

---

## Phase 1A — Identity (parallel-eligible after Phase 0)

**Goal:** real authentication and session management.

**Blocks (proposed):**

| Block | Tier | Purpose |
|-------|------|---------|
| 011 | M | Password auth + session token issue |
| 012 | M | Login API endpoint in `apps/api` |
| 013 | M | Session validation middleware |
| 014 | M | Login UI in `apps/web` |
| 015 | M | Password reset flow |
| 016 | M | MFA / TOTP (or skip until needed) |
| 017 | L | Identity Phase 1A exit gate |

**Parallel-with:** Phase 1B (Tenancy), 1C (Integrations), 1D (Normalization),
1E (Observability), 1F (UI-kit).

---

## Phase 1B — Tenancy (parallel-eligible after Phase 0)

**Goal:** tenant lifecycle, membership, basic roles.

**Blocks:**

| Block | Tier | Purpose |
|-------|------|---------|
| 018 | M | Tenant table + repository |
| 019 | M | TenantContext factory (`getTenantContext`) |
| 020 | M | Role definitions + enforcement |
| 021 | M | Plan limits + enforcement |
| 022 | M | Tenant CRUD API |
| 023 | M | Tenant onboarding UI |
| 024 | L | Tenancy Phase 1B exit gate |

---

## Phase 1C — Integrations (parallel-eligible after Phase 0)

**Goal:** ERP connector framework + at least one ERP connector.

**Blocks:**

| Block | Tier | Purpose |
|-------|------|---------|
| 025 | M | Connector interface + base class |
| 026 | M | Connection persistence (table + repository) |
| 027 | M | First ERP connector (which ERP? — user decides at phase start) |
| 028 | M | Pull scheduler |
| 029 | M | Raw payload storage |
| 030 | L | Integrations Phase 1C exit gate |

**Note:** "first ERP" is a Phase 1C decisions.md call. Likely the most common
in the user's target market.

---

## Phase 1D — Normalization (parallel-eligible after Phase 0)

**Goal:** canonical domain model + mapping framework.

**Blocks:**

| Block | Tier | Purpose |
|-------|------|---------|
| 031 | L | Canonical model design block (decisions.md) |
| 032 | M | Canonical entity tables + repositories |
| 033 | M | Mapping framework (`mapErpXxxToCanonical`) |
| 034 | M | Mapper for first ERP (depends on Phase 1C Block 027) |
| 035 | M | Deduplication + validation |
| 036 | L | Normalization Phase 1D exit gate |

**Cross-phase dependency:** Block 034 depends on Phase 1C Block 027. This is
explicit in the manifest.

---

## Phase 1E — Observability (typically completes within Phase 0)

In practice this might absorb into Phase 0 Block 003 + a few follow-ups.
Listed separately to acknowledge it as an ongoing concern.

---

## Phase 1F — UI Kit (parallel-eligible after Phase 0)

**Goal:** design system primitives.

**Blocks:**

| Block | Tier | Purpose |
|-------|------|---------|
| 037 | M | Design tokens + theme provider |
| 038 | M | Form primitives (Input, Select, Checkbox, ...) |
| 039 | M | Layout primitives (Card, Modal, Drawer, ...) |
| 040 | M | Data primitives (Table, Pagination, ...) |
| 041 | M | Chart wrappers (Recharts / Tremor / Chart.js — decide in phase) |
| 042 | L | UI-kit Phase 1F exit gate |

---

## Phase 2 — Composition (Analytics + Dashboard)

**Goal:** the actual SaaS value — KPIs and dashboards.

Depends on: Phase 1A (auth), 1B (tenancy), 1D (canonical model), 1F (UI kit).

**Blocks span:** `packages/analytics`, `packages/dashboard`, `apps/web` dashboard pages.

Estimated ~15-25 blocks; multiple domain agents run in parallel.

---

## Phase 3 — Productization (Billing, Notifications, Audit)

**Goal:** make it sellable.

Blocks in `packages/billing`, `packages/notifications`, `packages/audit`. Each
is a separate domain phase, mostly parallel.

---

## Phase 4+ — Iteration waves

Once the platform is operational, work happens in **waves** rather than phases:

- A wave is a 1-2 week iteration cycle.
- A wave contains 5-15 blocks across multiple domains.
- Most blocks are M-tier; some S-tier; rare L-tier.
- Blocks are grouped by feature (named in `features.md`), not by phase.

This is where the project spends most of its lifetime. The phase model gives
way to the wave model after Phase 3.

---

## Block lifecycle

(Mirrors the lifecycle in PROTOCOLS.md — repeated here for ergonomics.)

```
1. Block manifest authored (from a template) in ./manifests/active/
2. Agent assigned (single-writer rule: check STATE.md for domain conflict)
3. Agent reads PROTOCOLS.md + relevant addenda + package context + manifest
4. Agent implements within manifest scope
5. Agent validates: typecheck, lint, tests, conditional bench
6. Agent commits + opens PR
7. Governor reviews; CI passes
8. Governor merges
9. Governor updates ./STATE.md
10. Manifest moves to ./manifests/archive/
```

---

## Phase lifecycle

```
1. Phase folder created: ./phases/phase-<name>/
   - roadmap.md (block list, frozen at phase start)
   - decisions.md (architectural decisions; can be appended through the phase)
   - exit.md (criteria + PASS/FAIL stamps; populated as blocks land)
2. Blocks land per their dependencies (parallel where possible)
3. Last block runs the exit gate; exit.md stamps PASS
4. Governor archives:
   - phases/<name>/ → phases/archive/<name>/
   - completed manifests → manifests/archive/
   - retrospectives stay in archive
5. STATE.md updated to reflect phase complete
6. features.md updated if features unlocked
```

---

## Dependencies declaration

Block manifests declare dependencies explicitly:

```
Depends-on:
  - Block 014 (this repo)
  - Block 027 (Phase 1C, this repo)
  - contract: @saas/contracts/analytics/KpiResult (introduced in Block 030)
```

The Governor uses these to:
- Verify a block doesn't start before its dependencies merge.
- Compute the DAG for parallel scheduling.
- Detect cycles.

---

## Comparison vs the heavy sequential model

This pipeline is **not** the MMORPG style. Differences:

| MMORPG style | SaaS style |
|--------------|------------|
| Phases linear (Phase N must finish before Phase N+1) | Phases form a DAG (parallel where dependencies allow) |
| Every block has bench bracketing | Bench only when manifest declares performance-critical |
| Activation lifecycle (Skeleton → Real-Disabled → ramp) on every system | Skeleton-gating only on risky systems (auth, billing, public API, migrations) |
| Sequential validation of every change | Parallel work; integration gates at phase exit only |
| One agent at a time | Multiple agents in parallel (one per domain) |

The trade-off: SaaS pipeline favors **throughput** over **per-block ceremony**.
Quality and consistency are still enforced (axioms apply), but the framework
doesn't impose extra ceremony when it isn't earning safety.
