# Phase 0 — Exit gate

_Stamped by Block 010 on phase completion. Until then, status is Pending._
_Status: **Pending** — Phase 0 in progress._

---

## Exit criteria

Each criterion is a Pass/Fail gate. Block 010 evaluates all and stamps
the verdict; only when every criterion is Pass does Phase 0 close and
Phase 1A-1F unlock.

### EC-1 — All Phase 0 blocks Complete

**Threshold:** `manifests/active/` contains zero block-001 through block-009 manifests; all moved to `manifests/archive/` with `Status: Complete`.
**Measurement:** `governor next` reports no Pending blocks for Phase 0; archive directory contains all 9 implementation manifests.
**Pass/Fail:** Pending.

### EC-2 — `governor doctor` PASS

**Threshold:** `doctor: PASS (10/10)` or better.
**Measurement:** `cd orchestrator && npx tsx bin/governor.ts doctor`.
**Pass/Fail:** Pending.

### EC-3 — Workspace typecheck green

**Threshold:** `pnpm turbo run typecheck` exits 0 across all packages and apps.
**Measurement:** CI workflow + local re-run.
**Pass/Fail:** Pending.

### EC-4 — Workspace lint green

**Threshold:** `pnpm turbo run lint --max-warnings 0` exits 0.
**Measurement:** CI workflow + local re-run.
**Pass/Fail:** Pending.

### EC-5 — Workspace tests green (incl. placeholders)

**Threshold:** `pnpm turbo run test` exits 0. Each package has at least one passing test (even if a trivial smoke test).
**Measurement:** CI workflow + local re-run.
**Pass/Fail:** Pending.

### EC-6 — Tenant isolation pattern documented

**Threshold:** A working tenant-isolation test exists in at least one package (likely `packages/tenancy/__tests__/tenant-isolation.test.ts`) demonstrating that operations in tenant A cannot read tenant B's data. The pattern is described in [protocols/TENANT.md:166-173](../../protocols/TENANT.md:166).
**Measurement:** test file exists and passes.
**Pass/Fail:** Pending.

### EC-7 — `/health` endpoint responds 200

**Threshold:** `apps/api` boots locally (`pnpm dev --filter=@saas/api`) and `GET /health` returns `{ ok: true }` (or equivalent).
**Measurement:** `curl localhost:<port>/health` returns 200 with healthy body.
**Pass/Fail:** Pending.

### EC-8 — `apps/web` boots with login route

**Threshold:** `apps/web` boots locally (`pnpm dev --filter=@saas/web`) and the login route renders without errors. Login form is non-functional (no auth backend yet) — visual only.
**Measurement:** browser-side smoke check + console clean.
**Pass/Fail:** Pending.

### EC-9 — Postgres migration tool initialized

**Threshold:** `infrastructure/db/migrations/` exists with at least one applied initial migration. `pnpm db:migrate` (or chosen tool's equivalent) runs idempotently.
**Measurement:** migrate command output + `migrations` table row count.
**Pass/Fail:** Pending.

### EC-10 — CI workflow green on a synthetic PR

**Threshold:** A PR against `main` triggers GitHub Actions: typecheck + lint + test pass. The orchestrator pre-commit hook also fires correctly.
**Measurement:** Actions run history; pre-commit hook on `git commit`.
**Pass/Fail:** Pending.

### EC-11 — ADRs landed

**Threshold:** `decisions/` contains ADR-0001 (monorepo), ADR-0002 (Postgres ORM), ADR-0003 (HTTP framework), ADR-0004 (deploy), ADR-0005 (billing). Each `Status: Accepted`.
**Measurement:** file listing + frontmatter inspection.
**Pass/Fail:** Pending.

### EC-12 — `STATE.md` reflects Phase 0 complete

**Threshold:** `STATE.md` "Active phase" section reads "Phase 0 — Complete" with date, and "Package status" lists all 9 packages as `not bootstrapped` → `skeleton ready` (or equivalent).
**Measurement:** file inspection by Governor.
**Pass/Fail:** Pending.

---

## Stamp block (Block 010 fills this on completion)

**Phase 0 verdict:** Pending.
**Stamped on:** _not yet_.
**Stamped by:** Block 010 agent (`block-010-phase-0-exit-gate`).
**Doctor result at stamp:** _not yet_.
**Failing criteria (if any):** _n/a — pending_.

On stamp PASS, the Governor:

1. Updates `STATE.md` to mark Phase 0 complete and active phase = none (Phase 1A-F can each start).
2. Archives all Phase 0 manifests to `manifests/archive/`.
3. Adds an entry to `governance/log.md`.
4. Closes the phase by moving `phases/phase-0/` → `phases/archive/phase-0/` (the Governor handles this; not Block 010).
5. Unlocks Phases 1A-1F by allowing manifests targeting their packages to start.

---

## If exit fails

If any criterion is Fail at stamping:

1. Do NOT close Phase 0. Block 010 sets `Status: InProgress` on itself.
2. The Governor authors a remediation block (Tier S or M) to fix the failing criterion.
3. Re-run Block 010 after the remediation lands.
4. Repeat until all green.

Phase 0 does not partial-pass. Either all 12 criteria are green or Phase 0 stays open.
