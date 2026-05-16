# Workspace State

_Source of truth for cross-domain current state._
_Replace-only. Edited by the Governor on integration._
_Last updated: 2026-05-15 (Block 001 integrated; 1/10 done)._

---

## Active package work

| Package | Active agent | Current block | Worktree | Status |
|---------|--------------|---------------|----------|--------|
| _none yet_ | — | — | — | — |

Phase 0 is sequential; no agents assigned yet.

---

## Active phase

**Phase:** Phase 0 — Foundation (sequential)
**Started:** 2026-05-15 (manifests authored)
**Blocks complete:** 1 / 10
**Next:** `block-002-postgres-baseline` (M, depends on 001 — unblocked)
**Exit:** [`phases/phase-0/exit.md`](phases/phase-0/exit.md)

After Block 010 PASS: Phase 1A-1F unlock in parallel.

---

## Package status

| Package | Status | Block |
|---------|--------|-------|
| `contracts` | skeleton pending | 004 |
| `identity` | skeleton pending | 005 |
| `tenancy` | skeleton pending | 006 |
| `observability` | skeleton pending | 003 |
| `integrations` | not bootstrapped | Phase 1C (CISSPoder first) |
| `normalization` | not bootstrapped | Phase 1D (Br retail vocab) |
| `analytics` | not bootstrapped | Phase 2 |
| `dashboard` | not bootstrapped | Phase 2 |
| `ui-kit` | not bootstrapped | Phase 1F |

---

## Apps status

| App | Status | Block |
|-----|--------|-------|
| `apps/api` | shell pending | 007 (ADR-0003 inside) |
| `apps/web` | shell pending | 008 |

---

## Cross-cutting infrastructure

| Item | Status | Notes |
|------|--------|-------|
| Monorepo (pnpm + turbo) | **complete** | Block 001 merged at be17719 / ADR-0001 |
| PostgreSQL | pending | Block 002 / ADR-0002 (in block) |
| CI/CD | pending | Block 009 |
| Deploy target | Fly.io (PaaS-first, portable) | ADR-0004 |
| Billing | tier + usage caps | ADR-0005 |
| First ERP | CISSPoder | Phase 1C Block 027 |
| Project scope | `@saas/` | renamed from `@app/` 2026-05-15 |
| Orchestrator | green | doctor PASS 10/10 |

---

## Active features

See [`features.md`](features.md). None in Phase 0.

---

## Recent Governor activity

See [`governance/log.md`](governance/log.md) for entries. Highlights:

- 2026-05-15 — V3 foundation installed.
- 2026-05-15 — Scope rename `@app/` → `@saas/` (PROTOCOLS v3).
- 2026-05-15 — Phase 0 authored: 10 manifests, ADRs 0001/0004/0005,
  phase folder. Preflight READY × 10, conflicts clean, audit 0 errors.
- 2026-05-15 — Block 001 (monorepo skeleton) integrated: pnpm + turbo
  + TS strict + ESLint with D1 enforcement. Merge commit be17719.

---

## Worktree map

`governor scan` writes to `.governor/orchestrator/.cache.json`. No
Domain Agent worktrees active yet — `busy-chaplygin-d19ec0` is the
Governor session itself.
