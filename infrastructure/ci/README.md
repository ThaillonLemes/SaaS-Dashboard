# CI infrastructure

Owned by the DevOps Agent (`infrastructure/ci/`). Do not edit without a block manifest.

---

## Workflows

### `.github/workflows/ci.yml` — PR validation

**Triggers:** `pull_request` → `main`; `push` → `main`.

**Steps:**

| Step | Tool | Notes |
|------|------|-------|
| Checkout | `actions/checkout@v4` | Full history (`fetch-depth: 0`) for turbo affected-package detection |
| pnpm setup | `pnpm/action-setup@v4` | Reads version from `packageManager` in root `package.json` |
| Node setup | `actions/setup-node@v4` | Version from `.nvmrc`; pnpm store cached on lockfile hash |
| Install | `pnpm install --frozen-lockfile` | Fails fast if lockfile is out of date |
| Tasks | `pnpm turbo run typecheck lint test` | Three tasks run in parallel via turborepo |
| PR comment | `actions/github-script@v7` | Posts a failure link on red; skipped on push events |

**Turbo remote cache (optional):** Set two repository secrets/variables in GitHub:

```
TURBO_TOKEN   — secret  — Vercel or self-hosted remote-cache token
TURBO_TEAM    — variable — team slug (Vercel) or any non-empty string (self-hosted)
```

CI runs correctly without them; cold builds will be slower without remote cache.

---

### `.github/workflows/audit.yml` — Governor governance audit

**Triggers:** `pull_request` → `main`; weekly on Monday 06:00 UTC.

**What it does:** Runs `orchestrator/ci/audit.sh`, which calls `governor audit`
(13 governance rules: axiom coverage, manifest health, file caps, index pointers,
override tracking). Audit output is written to `governance/audit-<date>.md` and
uploaded as a workflow artifact.

**Blocking mode:** Audit is warn-only by default (exit 0). To block PRs on audit
errors, set the repository variable `GOVERNOR_AUDIT_BLOCKING = 1`. Recommended
only after 90 days of clean warn-only operation (false-positive rate < 5%).

---

## Running CI checks locally

```bash
pnpm turbo run typecheck lint test
```

This is exactly what CI runs. Turbo caches per-package results, so re-runs after
unchanged packages are near-instant.

---

## Installing the orchestrator pre-commit hooks

The orchestrator ships three git hooks:

- **`pre-commit-manifest.sh`** — rejects staged active manifests missing valid
  YAML frontmatter (`id`, `tier`, `status`).
- **`pre-commit-capability.sh`** — warns when an `agent/<domain>/` branch stages
  files outside its declared domain scope.
- **`post-commit-scan.sh`** — refreshes the orchestrator's worktree cache in the
  background after each commit.

Install from the workspace root:

```bash
cat orchestrator/hooks/pre-commit-manifest.sh \
    orchestrator/hooks/pre-commit-capability.sh > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

cp orchestrator/hooks/post-commit-scan.sh .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

Full install docs and verification steps: [`orchestrator/hooks/install.md`](../../orchestrator/hooks/install.md).

Hooks apply to every worktree under `.claude/worktrees/` automatically — no
per-worktree configuration needed.

---

## Branch protection (out of this block's scope)

Configure in GitHub → Settings → Branches → Branch protection rules for `main`:

- Require status checks: `ci / typecheck · lint · test`
- Require branches to be up to date before merging
- Restrict pushes to `main` (Governor integrates via `governor integrate`)

The `audit / governor audit` check is intentionally left non-required during the
warn-only period.
