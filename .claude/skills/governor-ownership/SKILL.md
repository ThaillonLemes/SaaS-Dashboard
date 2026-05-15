---
name: governor-ownership
description: Run `governor ownership <path>` to resolve who can edit a given file, what trust class it belongs to, and whether any active block manifest currently claims it. Use before editing an unfamiliar file, or when confirming ownership for a Governor proposal.
---

# /governor-ownership

You are resolving the ownership and trust class of a file. Goal: tell
the user (or the Governor) exactly who is allowed to edit this path
right now, and whether an active block claims it.

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts ownership <relative-path>
```

The command prints directly to stdout — no separate report file is
generated.

## Report

1. **Editor:** the role that owns this file (e.g., "Governor",
   "Identity Agent", "DevOps Agent").
2. **File class:** CANONICAL, HOT, OPERATIONAL, DERIVED, TRANSIENT, or
   GOV-PRIVATE.
3. **Active claims:** block IDs (if any) currently claiming the file in
   their `files.modify` or `files.create` set.
4. **Recommendation:** if the file is claimed, do not edit; coordinate
   with the claimer or wait for the block to merge.

## Notes

- Read-only command; safe to run any time.
- Use this before any cross-package edit, before any cognition-layer
  edit, and before authoring a Governor proposal that touches an
  unfamiliar path.
