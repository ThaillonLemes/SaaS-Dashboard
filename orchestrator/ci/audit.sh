#!/usr/bin/env bash
# audit.sh — CI wrapper for `governor audit`.
#
# Behavior (per .governor/v3/08-pending-decisions.md Q5):
#   - Default: warn-only. Exit 0 regardless of audit findings. Audit report
#     is printed and uploaded as a build artifact.
#   - Set GOVERNOR_AUDIT_BLOCKING=1 to flip to blocking mode: exit non-zero
#     on any ERROR-level finding. Recommended only after 90 days of
#     warn-only operation with false-positive rate < 5%.
#
# Class: CANONICAL. Edit only via Governor proposal.

set -u

REPO_TOP=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
WORKSPACE=""
dir="$REPO_TOP"
while [ "$dir" != "/" ] && [ -n "$dir" ]; do
  if [ -f "$dir/orchestrator.config.yaml" ]; then
    WORKSPACE="$dir"
    break
  fi
  parent=$(dirname "$dir")
  [ "$parent" = "$dir" ] && break
  dir="$parent"
done

if [ -z "$WORKSPACE" ]; then
  echo "audit.sh: no orchestrator.config.yaml found above $REPO_TOP — skipping" >&2
  exit 0
fi

cd "$WORKSPACE/orchestrator" || exit 0

if ! command -v node >/dev/null 2>&1; then
  echo "audit.sh: node not installed — skipping audit" >&2
  exit 0
fi

set +e
npx --yes tsx bin/governor.ts audit
AUDIT_EXIT=$?
set -e

if [ "${GOVERNOR_AUDIT_BLOCKING:-0}" = "1" ]; then
  exit "$AUDIT_EXIT"
fi

if [ "$AUDIT_EXIT" -ne 0 ]; then
  echo "" >&2
  echo "audit.sh: audit reported findings (exit $AUDIT_EXIT)." >&2
  echo "audit.sh: GOVERNOR_AUDIT_BLOCKING is unset; exiting 0 (warn-only)." >&2
fi
exit 0
