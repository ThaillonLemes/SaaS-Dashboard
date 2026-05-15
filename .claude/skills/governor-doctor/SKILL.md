---
name: governor-doctor
description: Run `governor doctor` — bootstrap-integrity self-check. Verifies workspace HOT files exist, schemas parse, config paths resolve, the repo is a git repo, and each declared worktree is present. Use at session start, before integrate, or whenever a command fails mysteriously.
---

# /governor-doctor

You are running the orchestrator's self-check. Goal: confirm the
workspace is bootable for any Governor command. Run at session start
and before any destructive operation (integrate, undo).

## Pre-read

1. `STATE.md` — to see whether any worktrees should currently exist.

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts doctor
```

## Report

1. **Verdict in one line:** "PASS — N/N checks" or "FAIL — M of N
   checks failed".
2. **For each failed check:** the failing file or path and the suggested
   fix.
3. **Recommendation:** if PASS, silent close. If FAIL, halt any
   intended destructive command and resolve the failure first.

## Notes

- `governor doctor` is read-only; safe to run any time.
- Common failures:
  - `orchestrator.config.yaml` missing or unparseable.
  - HOT file missing (e.g., `STATE.md` not at root).
  - A schema file (`orchestrator/schemas/*.schema.yaml`) is invalid YAML.
  - A worktree path declared in `STATE.md` no longer exists on disk.
- Exit code: 0 = PASS, 2 = FAIL.
