#!/usr/bin/env bash
# post-commit-scan.sh — Wave 1 — fire `governor scan` after each commit.
#
# Refreshes .governor/orchestrator/.cache.json so Governor sessions read a
# fresh view of worktrees and active manifests. Non-blocking: a scan failure
# never blocks the commit it follows.
#
# Class: CANONICAL. Edit only via Governor proposal.
#
# Install: see hooks/install.md.

set -u

# Resolve the workspace root by walking up from this repo's toplevel.
REPO_TOP=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$REPO_TOP" ]; then
  exit 0
fi

WORKSPACE=""
dir="$REPO_TOP"
while [ "$dir" != "/" ] && [ -n "$dir" ]; do
  if [ -f "$dir/orchestrator.config.yaml" ]; then
    WORKSPACE="$dir"
    break
  fi
  parent=$(dirname "$dir")
  if [ "$parent" = "$dir" ]; then break; fi
  dir="$parent"
done

if [ -z "$WORKSPACE" ]; then
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  exit 0
fi

# Run scan in background; don't block the commit pipeline.
( cd "$WORKSPACE/orchestrator" \
    && node --experimental-strip-types bin/governor.ts scan >/dev/null 2>&1 \
    || npx --yes tsx bin/governor.ts scan >/dev/null 2>&1 \
) &

exit 0
