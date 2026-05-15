---
name: governor-churn
description: Run `governor churn <package>` to compute top-N most-modified files in the recent commit history of a package. Use to find hotspots — files that signal architectural pressure or that consistently break tests. Outputs `governance/churn-<package>.md`.
---

# /governor-churn

You are identifying high-churn files in a package. Goal: surface
hotspots that may indicate architectural pressure (a single file growing
to do too many things) or test fragility.

## Pre-read

1. `STATE.md` — to confirm the package name.

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts churn <package-name> [--top 20] [--since-days 90]
```

Defaults: top 20, last 90 days.

Then read `governance/churn-<package>.md`.

## Report

1. **Top 5 churned files** with modification count.
2. **Pattern:** any file growing >100 lines repeatedly? Any test file
   in the top 5 (often a sign of flakiness)?
3. **Recommendation:** which files warrant a refactor block to split
   them up.

## Notes

- Churn is a *signal*, not a diagnosis. High churn can also mean active
  development on a healthy file.
- Combine with `governor ownership` to confirm churned files have a
  clear owner.
- `governance/churn-<package>.md` is DERIVED — regeneratable.
