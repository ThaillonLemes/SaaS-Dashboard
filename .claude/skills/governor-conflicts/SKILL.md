---
name: governor-conflicts
description: Run `governor conflicts` to intersect file-scope claims across all Pending/InProgress block manifests. Reports any file claimed by two or more active blocks. Use before authorizing a new block to confirm it doesn't collide with work already in flight.
---

# /governor-conflicts

You are checking for file-scope collisions across active block manifests.
Goal: tell the user whether any file is claimed by two or more Pending or
InProgress blocks. Run this before authorizing a new block, before
integrate, or whenever you suspect overlap.

## Pre-read

1. `STATE.md` — see which packages have active blocks.

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts conflicts
```

Then read `governance/conflicts.md`.

## Report

1. **Verdict in one line:** "No conflicts detected" OR "N conflicting
   file(s)".
2. **For each conflict:** show file path and the colliding block IDs
   with their status + kind (modify/create).
3. **Recommendation** — if conflicts exist: serialize the blocks, narrow
   scope on one, or escalate to a coordinator block. If no conflicts:
   silent close.

## Notes

- Only `Pending` and `InProgress` manifests contribute claims.
- Conflicts within a single block (same file declared modify + create)
  are NOT reported; the schema already prevents that.
- Manifests without YAML frontmatter contribute no claims and are
  silently skipped.
- `governance/conflicts.md` is OPERATIONAL — regeneratable; safe to
  delete and rerun.
