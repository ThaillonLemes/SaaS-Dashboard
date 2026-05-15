---
name: governor-audit
description: Run `governor audit` — 13 composable rules over the workspace. Loads PROTOCOLS.md + STATE.md + recent audit reports for context, executes the deterministic CLI, summarizes findings by rule, and points the user at the most recent OPERATIONAL audit report.
---

# /governor-audit

You are running the workspace audit. Goal: surface drift, comment
violations, oversized HOT files, stale manifests, ownership leaks, and
other systemic issues — then give the user a one-line verdict and a path
to the full report.

## Pre-read

1. `PROTOCOLS.md` — to ground audit findings in axiom references.
2. `STATE.md` — to know which packages are currently active.
3. The most recent prior audit at `governance/audit-*.md` (if any) for
   trend context.

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts audit
```

To run a subset:

```bash
npx tsx bin/governor.ts audit --only 00,01,04
```

Then read `governance/audit-<YYYY-MM-DD>.md`.

## Report

1. **One-line summary:** "Audit clean" OR "N errors, M warnings across K
   rules."
2. **Top 3 findings** with rule ID, axiom reference, and file path.
3. **Comparison vs prior audit** (if available): is the codebase
   trending healthier or noisier?
4. **Recommendation:** which findings warrant follow-up blocks vs. which
   are advisory.

## Notes

- 13 rules — see `orchestrator/audit-rules/*.yaml` for each rule's
  config.
- Exit code: 0 if all findings are WARNINGs, 2 if any ERRORs.
- Rule 05 regenerates `governance/overrides.md` as a side effect.
- `governance/audit-<date>.md` is OPERATIONAL — keep recent ones for
  trend analysis; archive older ones via Governor proposal.
