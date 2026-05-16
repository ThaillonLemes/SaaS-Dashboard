#!/usr/bin/env bash
# pre-commit-manifest.sh — minimal manifest frontmatter check.
#
# Rejects staged manifest files (in manifests/active/) that lack a
# well-formed YAML frontmatter block with id, tier, and status fields.
#
# This is REGEX-only. Full JSON Schema validation is available via
# `governor preflight <manifest>`. The hook's intent is to catch obvious
# omissions, not to verify schema conformance.
#
# Class: CANONICAL. Edit only via Governor proposal.
#
# Install: see hooks/install.md.

set -euo pipefail

# Collect staged manifest files. Matches manifests/active/block-NNN-*.md.
mapfile -t MANIFESTS < <(
  git diff --cached --name-only --diff-filter=ACM \
    | grep -E '(^|/)manifests/active/block-[0-9]{3}(-[a-z0-9-]+)?\.md$' \
    || true
)

if [ ${#MANIFESTS[@]} -eq 0 ]; then
  exit 0
fi

FAIL=0
for f in "${MANIFESTS[@]}"; do
  if [ ! -f "$f" ]; then
    continue
  fi

  # Extract first 200 lines for inspection.
  HEAD=$(head -n 200 "$f")

  # Rule 1: must start with `---` on line 1.
  if ! printf '%s\n' "$HEAD" | head -n 1 | grep -qE '^---[[:space:]]*$'; then
    echo "manifest-frontmatter: $f — missing opening '---' on line 1" >&2
    FAIL=1
    continue
  fi

  # Rule 2: must contain a closing `---` within first 200 lines.
  # (Frontmatter cannot reasonably exceed 200 lines.)
  CLOSE_LINE=$(printf '%s\n' "$HEAD" | awk 'NR>1 && /^---[[:space:]]*$/{print NR; exit}')
  if [ -z "$CLOSE_LINE" ]; then
    echo "manifest-frontmatter: $f — no closing '---' within first 200 lines" >&2
    FAIL=1
    continue
  fi

  # Extract frontmatter body (between line 1 and the closing ---).
  FM=$(printf '%s\n' "$HEAD" | sed -n "2,$((CLOSE_LINE - 1))p")

  # Rule 3: must contain id:, tier:, status: keys at start of line.
  for key in id tier status; do
    if ! printf '%s\n' "$FM" | grep -qE "^${key}:[[:space:]]+"; then
      echo "manifest-frontmatter: $f — missing required field '${key}'" >&2
      FAIL=1
    fi
  done

  # Rule 4: tier value must be S, M, or L.
  TIER=$(printf '%s\n' "$FM" | sed -nE 's/^tier:[[:space:]]+([SML])[[:space:]]*$/\1/p' | head -n 1)
  if [ -z "$TIER" ]; then
    echo "manifest-frontmatter: $f — tier must be one of: S, M, L" >&2
    FAIL=1
  fi
done

if [ "$FAIL" -ne 0 ]; then
  echo "" >&2
  echo "Manifest frontmatter validation failed. See errors above." >&2
  echo "Templates: templates/manifest-{S,M,L}.md" >&2
  echo "Run: orchestrator/bin/governor.ts preflight <manifest> for full validation." >&2
  exit 1
fi

exit 0
