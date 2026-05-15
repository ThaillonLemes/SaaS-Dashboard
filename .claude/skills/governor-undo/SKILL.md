---
name: governor-undo
description: Run `governor undo [txn-id]` — replays inverse operations from the most recent (or named) transaction. Reverses `integrate` via `git reset --hard <sha_before>` and reverse file-move. Use within minutes of a bad integrate, before any subsequent commits would obscure the reset.
---

# /governor-undo

You are reversing the most recent (or named) `governor integrate`. This
is DESTRUCTIVE — it `git reset --hard`s `main` and moves manifest files
back. Always get explicit user approval before running.

## Pre-read

1. `.governor/orchestrator/transactions/` — list recent transactions
   to confirm the target.
2. `governance/log.md` — confirm no subsequent integrations have landed
   that would be lost.

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts undo [<txn-id>]
```

Omit `<txn-id>` to undo the latest transaction.

## Report

1. **Transaction targeted:** ID + timestamp + description.
2. **Steps replayed:** each `DONE`/`FAIL` line from the command.
3. **Outcome:** OK or FAIL with the failure reason.

## Notes

- Reversal works ONLY if no subsequent commits have landed on `main`
  after the targeted integrate. If commits exist, `undo` refuses and
  asks the Governor to manually revert via PR instead.
- Reverse operations:
  1. `git reset --hard <sha_before_integrate>`.
  2. Move the manifest from `manifests/archive/` back to
     `manifests/active/`.
  3. Append an "undo" entry to the transaction journal (the journal
     itself is append-only — undo logs the reversal, doesn't delete the
     original entry).
- Re-run preflight after undoing if you intend to retry the integration.
