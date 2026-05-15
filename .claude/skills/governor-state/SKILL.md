---
name: governor-state
description: Run `governor state` to build `STATE.proposed.md` from per-package state. Loads the cross-domain SSoT for comparison, reports the diff between current `STATE.md` and the freshly proposed version, and reminds the user that promotion is a Governor action (never auto).
---

# /governor-state

You are refreshing the cross-package state proposal. Goal: present the
Governor with an up-to-date proposed `STATE.md` so they can hand-edit
the SSoT.

## Pre-read

1. `STATE.md` — the current source of truth (Governor-edited).
2. `.governor/orchestrator/.cache.json` (auto-loaded by the command if
   present; otherwise the command will scan first).

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts state
```

Then read `STATE.proposed.md`.

## Report

1. **Where the proposal lives:** `STATE.proposed.md` (DERIVED;
   regeneratable).
2. **Key diff vs current STATE.md:** highlight any new worktree, any
   closed worktree, any new manifest, any new phase.
3. **Recommendation:** "STATE.md is up to date — no change needed" OR
   "STATE.md should be updated to reflect: <bulleted diff>."

## Notes

- `STATE.proposed.md` is **never** auto-promoted. The Governor edits
  `STATE.md` by hand using the proposal as input.
- Run before composing the next phase or before integrating to ensure
  the snapshot is fresh.
- If the cache is stale (no `.cache.json` or older than the most recent
  commit), `governor state` re-scans first.
