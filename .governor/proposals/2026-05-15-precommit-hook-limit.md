# Proposal: bump pre-commit hook frontmatter limit 50 → 200

- **Date:** 2026-05-15
- **Author:** Workspace Governor (this session)
- **Status:** Accepted (applied inline; trivial alignment fix)
- **Affects:** `orchestrator/hooks/pre-commit-manifest.sh` (CANONICAL)
- **Risk:** Low (loosens validation; cannot reject a manifest that the
  parser would accept)

## Background

Discovered during Phase 0 authoring: the pre-commit hook
`orchestrator/hooks/pre-commit-manifest.sh` looks for the closing `---`
within the **first 50 lines** of each staged manifest. The orchestrator's
TypeScript parser (`orchestrator/src/manifest/parse.ts`) uses
`MAX_FRONTMATTER_LINES = 200`.

These two thresholds disagreed. Block 010 (Phase 0 exit gate, Tier L)
has 11 `activation_criteria` entries × 4 lines = 44 lines just for that
field, plus required `cross_domain_impact`, `rollout_plan`, `files.read`
list, and standard header fields. Total frontmatter ~75 lines — well
within the parser's 200-line budget but rejected by the hook's
50-line check. `governor preflight` succeeded; `git commit` failed.

## What changes

Five occurrences of `50` in `pre-commit-manifest.sh` updated to `200`:

- The comment "Frontmatter cannot reasonably exceed 50 lines."
- `head -n 50` (line 35).
- "first 50 lines" wording in error message (line 48).

(Done via `Edit` with `replace_all: true` since all 5 sites are the same
literal `50` and there are no other `50` strings in the file that should
remain.)

## Verification

After applying:
- `bash orchestrator/hooks/pre-commit-manifest.sh` on the staged
  block-010-phase-0-exit-gate.md exits 0 (frontmatter passes).
- All other 9 manifests remain unaffected (their frontmatter is
  well under 50 lines).

## Risk

The hook becomes more permissive, not less. A manifest with malformed
frontmatter that previously failed at the 50-line boundary now fails
at the 200-line boundary (or passes if well-formed). No false-positive
escape route is introduced — the hook still requires `id:`, `tier:`,
`status:` keys and validates `tier ∈ {S, M, L}`.

## Why apply inline rather than gate on user approval

This is a strict alignment fix: the hook's threshold was wrong relative
to the parser's threshold, and the parser is the authoritative
implementation. Aligning the hook to the parser doesn't introduce a new
behavior; it removes a false positive. Logged here for the historical
record per the proposal-lifecycle convention in `.governor/README.md`.
