---
name: governor-integrate
description: Run `governor integrate <repo> <branch>` — transactional merge of a worktree branch into main, with manifest archival and ledger entry. DESTRUCTIVE — always run `--dry-run` first, present the plan to the user for explicit approval, then re-run without `--dry-run` only on confirmation.
---

# /governor-integrate

You are merging an agent's worktree branch into `main`. This is the
single destructive Governor command. **Always run dry-run first** and
get explicit user approval before re-running live.

## Pre-read

1. `STATE.md` — to confirm the branch and worktree are tracked.
2. The block manifest in `manifests/active/<block-id>.md` — confirm
   `status:` is `Complete`.
3. Output of `/governor-preflight <manifest>` — confirm READY.
4. Output of `/governor-conflicts` — confirm no collisions.
5. CI status — confirm green on the PR.

## Execute — dry run first (always)

```bash
cd orchestrator
npx tsx bin/governor.ts integrate <repo-name> <branch-name> --dry-run
```

Present the planned steps to the user. Wait for explicit approval before
proceeding.

## Execute — live (only after approval)

```bash
cd orchestrator
npx tsx bin/governor.ts integrate <repo-name> <branch-name>
```

## Report

1. **Steps planned (dry-run) or applied (live):** each `PLAN`/`DONE`
   line emitted by the command.
2. **Transaction ID:** for use with `governor undo` if rollback is
   needed.
3. **Outcome:** OK or FAIL with the failure reason.

## Notes

- Integration steps:
  1. Verify branch is fast-forward mergeable into `main`.
  2. Merge the branch into `main` (no-ff, with a generated merge
     commit).
  3. Move the manifest from `manifests/active/` to
     `manifests/archive/`.
  4. Update the block log if configured.
  5. Append a transaction entry to
     `.governor/orchestrator/transactions/`.
- Refuses to merge if:
  - Preflight has not been run on the manifest.
  - The branch has a merge conflict with `main`.
  - The PR's CI is not green.
- Reversal: `governor undo <txn-id>` replays inverse operations within
  the same session window.
