# Installing the orchestrator git hooks

Three hooks ship in this directory:

- [`pre-commit-manifest.sh`](pre-commit-manifest.sh) — Rejects staged
  manifests in `manifests/active/` lacking valid YAML frontmatter (id,
  tier, status).
- [`pre-commit-capability.sh`](pre-commit-capability.sh) — WARN-only.
  Warns when a commit on an `agent/<domain>/...` branch stages paths
  outside the domain's ownership scope.
- [`post-commit-scan.sh`](post-commit-scan.sh) — Non-blocking. Refreshes
  `.governor/orchestrator/.cache.json` in the background after each
  commit so subsequent Governor sessions read a fresh view.

All hooks are **opt-in**. The Governor never edits `.git/` of the
workspace; install is a manual action by the user or DevOps Agent.

---

## Minimal install (recommended)

Run from the workspace root:

```bash
cat orchestrator/hooks/pre-commit-manifest.sh \
    orchestrator/hooks/pre-commit-capability.sh > .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

cp orchestrator/hooks/post-commit-scan.sh .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

Re-runs are idempotent — the pre-commit chain exits 0 when no manifest
files are staged; the capability hook always exits 0. The post-commit
scan runs in the background and never blocks.

---

## Worktree install

Worktrees share `.git/` with the parent repo, so installing hooks in
the workspace root applies to every worktree under `.claude/worktrees/`
automatically. No per-worktree configuration needed.

---

## Verifying

Stage a malformed manifest and try to commit:

```bash
mkdir -p manifests/active
echo "# Block 999 — Test" > manifests/active/block-999-test.md
git add manifests/active/block-999-test.md
git commit -m "test"
# Expected: rejected with "manifest-frontmatter: ... missing opening '---' on line 1"
```

Then discard:

```bash
git reset HEAD manifests/active/block-999-test.md
rm manifests/active/block-999-test.md
```

---

## Scope limits

- Pre-commit manifest check fires only on staged files matching
  `manifests/active/block-NNN[-slug].md`. Archived manifests are never
  checked.
- The capability hook fires only on branches whose names start with
  `agent/<domain>/`. Other branches (main, governor work, etc.) are
  skipped.
- The post-commit scan requires `node` (>=20) and `tsx`. `tsx` is
  auto-fetched by `npx --yes` if not preinstalled.
