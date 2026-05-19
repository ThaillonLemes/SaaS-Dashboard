---
id: block-010-phase-0-exit-gate
tier: L
kind: gate
phase: Phase 0 — Foundation
scope: phase-bound
status: Complete
domain: infrastructure/phase-gate
risk: high
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
  - block-002-postgres-baseline
  - block-003-observability
  - block-004-contracts-skeleton
  - block-005-identity-skeleton
  - block-006-tenancy-skeleton
  - block-007-api-shell
  - block-008-web-shell
  - block-009-ci-pipeline
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - phases/phase-0/roadmap.md
    - phases/phase-0/decisions.md
    - manifests/archive/block-001-monorepo-skeleton.md
    - manifests/archive/block-002-postgres-baseline.md
    - manifests/archive/block-003-observability.md
    - manifests/archive/block-004-contracts-skeleton.md
    - manifests/archive/block-005-identity-skeleton.md
    - manifests/archive/block-006-tenancy-skeleton.md
    - manifests/archive/block-007-api-shell.md
    - manifests/archive/block-008-web-shell.md
    - manifests/archive/block-009-ci-pipeline.md
  modify:
    - phases/phase-0/exit.md
  create:
    - governance/phase-0-exit-report.md
benchmarks: []
flags: []
metrics: []
cross_domain_impact:
  affected_packages:
    - infrastructure/monorepo
    - infrastructure/db
    - infrastructure/ci
    - packages/observability
    - packages/contracts
    - packages/identity
    - packages/tenancy
    - apps/api
    - apps/web
  contract_breaking: false
  schema_migration: false
rollout_plan:
  stages:
    - released-default
activation_criteria:
  - name: All Phase 0 blocks Complete
    threshold: "9 of 9 blocks (001-009) in manifests/archive/ with status: Complete"
    measurement: "governor next reports zero Pending blocks for Phase 0; archive directory listing"
    pass_fail: Pass
  - name: governor doctor PASS
    threshold: "PASS (10/10) or better"
    measurement: "cd orchestrator && npx tsx bin/governor.ts doctor"
    pass_fail: Pass
  - name: Workspace typecheck green
    threshold: "pnpm turbo run typecheck exits 0"
    measurement: "CI workflow + local re-run"
    pass_fail: Pass
  - name: Workspace lint green
    threshold: "pnpm turbo run lint --max-warnings 0 exits 0"
    measurement: "CI workflow + local re-run"
    pass_fail: Pass
  - name: Workspace tests green
    threshold: "pnpm turbo run test exits 0; each package has at least one passing test"
    measurement: "CI workflow + local re-run; test report aggregated"
    pass_fail: Pass
  - name: API /health endpoint responds
    threshold: "GET /health returns 200 with { ok: true, version, uptime }"
    measurement: "curl localhost:<port>/health on locally-running apps/api"
    pass_fail: Pass
  - name: Web shell boots
    threshold: "apps/web boots; /login route renders without console errors"
    measurement: "browser smoke check + console clean"
    pass_fail: Pass
  - name: Postgres migration tool initialized
    threshold: "pnpm db:migrate (or npx drizzle-kit equivalent) runs idempotently on a fresh DB"
    measurement: "Docker-compose Postgres + migration command + migrations table inspection"
    pass_fail: Pass
  - name: CI workflow green
    threshold: "A no-op PR triggers GitHub Actions; typecheck + lint + test + audit all green"
    measurement: "GitHub Actions run history"
    pass_fail: Pass
  - name: ADRs landed
    threshold: "decisions/ contains ADR-0001 (monorepo), ADR-0002 (Postgres ORM), ADR-0003 (HTTP framework), ADR-0004 (deploy), ADR-0005 (billing); each Status: Accepted"
    measurement: "file listing + frontmatter inspection"
    pass_fail: Pass
  - name: STATE.md reflects Phase 0 complete
    threshold: "STATE.md active phase = none; package status updated for all 9 packages"
    measurement: "Governor inspection"
    pass_fail: Pass
---

# Block 010 — Phase 0 exit gate

## 1. Purpose

Verify every Phase 0 deliverable is green and stamp `phases/phase-0/exit.md`.
On PASS: Phase 1A-1F unlock (Identity, Tenancy, Integrations, Normalization,
Observability follow-ups, UI-kit can each start; single-writer-per-package
enforced via STATE.md). On FAIL: Phase 0 stays open; remediation blocks
land and Block 010 re-runs.

## 2. Dependencies

All Phase 0 implementation blocks (001-009). The gate cannot run until
each is `Status: Complete` and archived.

## 3. Scope

### Inspect each criterion

Eleven activation criteria are declared in this manifest's frontmatter.
The Block 010 agent (the Workspace Governor, in practice) verifies each
and stamps `phases/phase-0/exit.md` with Pass/Fail per criterion.

### Author the exit report

`governance/phase-0-exit-report.md` is created with:
- One section per criterion: name, threshold, measurement output,
  verdict.
- A summary table.
- The doctor output verbatim at gate time.
- The next-phase unlock note (if PASS).

### Stamp `phases/phase-0/exit.md`

The Pending placeholders in `exit.md` become `Pass` or `Fail`. The stamp
block at the bottom records the verdict + date + doctor result.

## 4. Validation

The block's validation IS the criteria check. If all 11 criteria Pass:
- `exit.md` stamps PASS.
- `STATE.md` updates per [phases/phase-0/exit.md:101-108](../../phases/phase-0/exit.md:101).
- The Governor (separately, as part of integrate) archives the Phase 0
  manifests and moves `phases/phase-0/` → `phases/archive/phase-0/`.

If any criterion fails:
- `exit.md` stamps FAIL with the failing criteria listed.
- Phase 0 stays open.
- Governor authors a remediation block (Tier S or M).
- Block 010 re-runs after the remediation lands (its Status flips
  back to Pending).

## 5. Rollback signals

- An activation criterion was stamped Pass but later regressed (e.g., a
  Phase 1A block broke `pnpm typecheck`). Then this block's PASS stamp
  is retroactively invalid. The Governor opens a remediation Tier-M
  block; Phase 1 work pauses until green.
- A criterion's measurement command itself errors (orchestrator bug or
  missing dep). Then the criterion is `Pending`, not `Fail`; fix the
  measurement first.

## 6. Expected outcomes

After successful gate:
- `STATE.md` Active phase = "none — Phase 1A-1F may each start
  independently."
- All 9 implementation blocks moved to `manifests/archive/`.
- `phases/phase-0/exit.md` stamped PASS.
- `governance/log.md` records Phase 0 closure.
- Phase 1A (Identity), Phase 1B (Tenancy), Phase 1C (Integrations —
  CISSPoder first connector), Phase 1D (Normalization), Phase 1F (UI-Kit)
  can each spin up a Domain Agent in parallel.

## 7. Tenant safety check

- [x] N/A — gate touches no tenant-scoped data.
- [x] BUT: the gate verifies the **tenant-isolation test pattern** is
      documented (criterion is implicit in the lint + test green
      criteria; explicitly checked via grep of `protocols/TENANT.md`
      references in package READMEs).

## 8. Cross-domain check

- [x] No deep imports across packages (D1) — gate writes no source code.
- [x] All cross-domain types verified in place via Block 004 archive.
- [x] No utility duplication — gate adds no utilities.

## 9. Cross-Domain Impact

Affected packages: every Phase 0 deliverable
(`infrastructure/monorepo`, `infrastructure/db`, `infrastructure/ci`,
9 packages, 2 apps). The gate doesn't modify these — it verifies them
collectively.

`contract_breaking`: false — gate doesn't change contracts.
`schema_migration`: false — gate doesn't migrate schema.

## 10. Rollout Plan

Single stage: `released-default`. There's no flag, no ramp; the gate
either stamps PASS (Phase 1 unlocks) or stamps FAIL (Phase 0 stays
open). No partial rollout possible.

## 11. Activation criteria

Eleven criteria declared in frontmatter. See section above + the
matching detail in `phases/phase-0/exit.md`.

## 12. Risks

- **Risk:** A criterion's threshold is too strict, blocking a real Phase 1 start when foundation is "good enough." **Mitigation:** Governor reviews each criterion against the actual deliverable; if a criterion was misjudged, opens a Governor proposal to revise *before* re-running the gate (not after — moving goalposts is forbidden once a gate is open).
- **Risk:** The audit workflow (Block 009) has rule-violation findings that aren't truly violations. **Mitigation:** Each finding is reviewed; false positives produce orchestrator-side fixes (a Governor block on `orchestrator/audit-rules/`); true positives produce remediation blocks.
- **Risk:** `pnpm test` is flaky (e.g., docker postgres not up). **Mitigation:** CI workflow uses Postgres service container; local runs document the `pnpm db:up` prerequisite.

## 13. Out of scope

- Phase 1 work itself.
- Phase 0 retrospective doc (Governor authors separately if useful).
- Production deploy verification (operator action; not part of Phase 0).

## 14. New abstraction

None. The block runs deterministic checks against existing artifacts.

## 15. Communication plan

- **Before:** Governor notifies user via session that Phase 0 is ready
  for gate evaluation.
- **During:** Each criterion's result reported in session.
- **After PASS:** Governor announces Phase 1 unlock; lists which phases
  can start in parallel; awaits user's pick for first agent assignment.
- **After FAIL:** Governor announces which criteria failed; proposes
  remediation block(s); awaits user approval.
