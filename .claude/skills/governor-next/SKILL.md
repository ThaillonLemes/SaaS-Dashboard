---
name: governor-next
description: Run `governor next` to compute the DAG of pending/in-progress block manifests. Reports the topological order, schema validation status, and any legacy (no-frontmatter) manifests still in active/. Use when planning the next block or auditing the active queue.
---

# /governor-next

You are computing the dependency DAG of pending blocks. Goal: tell the
user which blocks are unblocked, which are waiting on prerequisites,
and what the next reasonable block to start is.

## Pre-read

1. `STATE.md` — to know which packages are currently held.

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts next
```

Then read `governance/dag.md`.

## Report

1. **Topological summary:** N pending manifests; M unblocked (ready to
   start); K waiting on prerequisites.
2. **Top of queue:** the first 3 unblocked manifests, with their domain
   + tier + estimated effort.
3. **Recommendation:** which block to authorize next, given current
   parallelism (cross-reference `STATE.md` for free packages).

## Notes

- The DAG considers `dependencies:` and `parallel_with:` frontmatter.
- Manifests missing required frontmatter are listed as "legacy" and
  contribute no DAG edges.
- `governance/dag.md` is DERIVED — regeneratable. Carries a footer with
  source hashes.
