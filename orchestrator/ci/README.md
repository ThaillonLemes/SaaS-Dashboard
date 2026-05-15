# CI integration for `governor audit`

**Stance:** WARN-only for the first 90 days of operation. Flip to
blocking only after the user has confidence in the false-positive
rate.

---

## What's here

| File | Purpose |
|------|---------|
| `audit.sh` | Shell wrapper around `governor audit`; respects `GOVERNOR_AUDIT_BLOCKING` env var |
| `github-actions-audit.yml` | GitHub Actions workflow template — copy into `.github/workflows/audit.yml` |

---

## Install

```bash
mkdir -p .github/workflows
cp orchestrator/ci/github-actions-audit.yml .github/workflows/audit.yml
git add .github/workflows/audit.yml
git commit -m "ci: add governor audit (warn-only)"
```

Because this is a monorepo, the orchestrator lives in the same checkout
that the workflow operates on. No vendor/publish gymnastics are needed
(unlike the MMORPG split-repo case).

---

## Modes

| `GOVERNOR_AUDIT_BLOCKING` | Behavior |
|---------------------------|----------|
| unset or `0` (default) | Audit runs; findings printed; report uploaded as artifact; exit always 0 |
| `1` | Audit runs; exit non-zero if ERROR-level findings present |

The flip decision belongs to the user. Recommended threshold: 90 days of
clean warn-only operation with false-positive rate < 5%, then set the
GitHub Actions repo variable `GOVERNOR_AUDIT_BLOCKING=1`.

---

## Local run

```bash
bash orchestrator/ci/audit.sh
```

Works from anywhere inside the workspace tree — the script walks up to
find `orchestrator.config.yaml`.
