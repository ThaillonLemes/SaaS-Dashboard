---
id: block-009-ci-pipeline
tier: M
kind: implementation
phase: Phase 0 — Foundation
scope: phase-bound
status: Pending
domain: infrastructure/ci
risk: medium
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - decisions/ADR-0001-monorepo.md
    - decisions/ADR-0004-deploy.md
    - orchestrator/ci/audit.sh
    - orchestrator/ci/github-actions-audit.yml
    - orchestrator/hooks/install.md
  modify: []
  create:
    - .github/workflows/ci.yml
    - .github/workflows/audit.yml
    - infrastructure/ci/README.md
    - infrastructure/deploy/README.md
    - infrastructure/deploy/Dockerfile.shared-notes.md
benchmarks: []
flags: []
metrics: []
---

# Block 009 — CI pipeline + deploy notes

## 1. Purpose

Land the GitHub Actions workflows for: (a) PR validation —
typecheck + lint + test across the workspace via turborepo; (b)
orchestrator governance audit per `orchestrator/ci/`. Document
PaaS-first portable deploy approach per ADR-0004 in
`infrastructure/deploy/README.md`.

## 2. Dependencies

- Block 001 (workspace must exist; turbo tasks must be wired).

## 3. Scope

### `.github/workflows/ci.yml`

Triggers: `pull_request` against `main`; `push` to `main`.

Steps:
1. Checkout (`actions/checkout@v4`).
2. Setup Node 22 (`actions/setup-node@v4` with `.nvmrc`).
3. Setup pnpm (`pnpm/action-setup@v4`).
4. Install: `pnpm install --frozen-lockfile`.
5. Turbo tasks in parallel: `pnpm turbo run typecheck lint test`.
6. (If PR) Comment on the PR with the failure summary on red.

Cache: pnpm store via `actions/cache` keyed on `pnpm-lock.yaml`.
Turborepo remote cache: env vars `TURBO_TOKEN` + `TURBO_TEAM` if
configured (deferred to user; CI runs without cache initially).

### `.github/workflows/audit.yml`

Triggers: `pull_request`; weekly schedule.

Runs `orchestrator/ci/audit.sh` (or the inline equivalent from
`orchestrator/ci/github-actions-audit.yml`). Reports go to
`governance/audit-<date>.md`.

### `infrastructure/ci/README.md`

Documents:
- What the CI workflows do.
- How to install the orchestrator's pre-commit hooks locally (links to
  `orchestrator/hooks/install.md`).
- How turbo remote cache is wired (and how to skip it).
- How to run CI checks locally (`pnpm turbo run typecheck lint test`).

### `infrastructure/deploy/README.md`

Documents per ADR-0004:
- PaaS-first portable deploy approach.
- Recommended PaaS: Fly.io (Railway / Render acceptable).
- The portability constraints (12-factor, no PaaS-specific features).
- Migration trigger to AWS/GCP.
- Deploy steps per app (`apps/api`, `apps/web`) — placeholder until the
  agent / user picks the concrete PaaS.

### `infrastructure/deploy/Dockerfile.shared-notes.md`

Notes about the multi-stage Dockerfile pattern used in `apps/api/Dockerfile`
and `apps/web/Dockerfile`. Documents the portability constraints
(HEALTHCHECK, `PORT` env, no platform-specific volumes).

## 4. Validation

- `.github/workflows/ci.yml` triggers and passes on a no-op PR.
- The audit workflow runs and emits a report file.
- The orchestrator's `pre-commit-manifest.sh` and
  `pre-commit-capability.sh` install per `orchestrator/hooks/install.md`
  on a developer machine.
- `infrastructure/ci/README.md` documents the workflow and hook setup.
- `infrastructure/deploy/README.md` documents ADR-0004 in operational
  terms.

## 5. Rollback signals

- CI workflow YAML fails to parse on GitHub (syntax error).
- Turbo cache key collides with another repo (unlikely; keyed on full
  lockfile content).
- Audit workflow fails on a green tree (the orchestrator's audit-rules
  are deterministic; a CI failure here means an orchestrator bug — file
  an issue, don't paper over).

## 6. Expected outcomes

After integration:
- Every PR runs typecheck + lint + test + audit automatically.
- Failed audits / tests block merge (when branch-protection is
  configured — outside this block's scope).
- The DevOps Agent (per
  [AGENT_OPERATING_MODEL.md:349-378](../../AGENT_OPERATING_MODEL.md:349))
  is the sole writer to `infrastructure/ci/` and
  `infrastructure/deploy/` going forward.

## 7. Tenant safety check

- [x] N/A — CI / deploy infra has no tenant data.

## 8. Cross-domain check

- [x] No deep imports across packages (D1).
- [x] N/A — block touches no source code.
- [x] No utility duplication — CI workflows centralized at root.

## 9. Risks

- **Risk:** GitHub Actions free-tier minutes run out. **Mitigation:** Turbo cache + only run on PR; reduce parallelism if needed.
- **Risk:** The orchestrator's `audit.sh` makes assumptions about local paths that break in CI. **Mitigation:** Use the YAML template at `orchestrator/ci/github-actions-audit.yml` which is CI-aware.
- **Risk:** Branch protection isn't set up by this block. **Mitigation:** Documented in `infrastructure/ci/README.md`; user / Governor configures via GitHub settings (out of scope).

## 10. Out of scope

- Deploy workflow / production deploy (operator action — pick PaaS first).
- Branch protection rules (GitHub-side config).
- Secrets management (operator action — PaaS-specific).
- Release automation / changelog (Phase 3+).
- E2E tests in CI (Phase 1+ when there's a real flow to test).

## 11. New abstraction

None. Standard GitHub Actions + turborepo idioms.
