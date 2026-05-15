---
name: governor-metrics
description: Run `governor metrics` to aggregate audit + integration + manifest signals into `governance/metrics.md`. Use to see whether the workspace is getting healthier or noisier over time. Best after Wave 2 has been operational for ≥ 1 month so the signals have mass.
---

# /governor-metrics

You are aggregating workspace-health signals. Goal: a single page that
tells the user whether the workspace is trending healthier or noisier
over the recent history.

## Pre-read

1. The most recent audit report at `governance/audit-*.md`.
2. `.governor/orchestrator/transactions/` — recent integrations.

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts metrics
```

Then read `governance/metrics.md`.

## Report

1. **Health verdict:** "Trending healthier", "Steady", or "Trending
   noisier" with one-sentence reasoning.
2. **Top movers:** the audit rule with the largest week-over-week
   change, integration cadence, manifest-age outliers.
3. **Recommendation:** if noisier — which axiom or rule is the likely
   culprit and what block could address it.

## Notes

- Metrics are meaningful only after at least 3-4 audits exist.
- Signals aggregated: audit-rule severity counts, integration count per
  week, mean manifest age, override count by axiom group.
- `governance/metrics.md` is DERIVED — regeneratable.
