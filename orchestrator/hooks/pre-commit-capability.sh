#!/usr/bin/env bash
# pre-commit-capability.sh — warns when a staged commit touches paths
# outside the current agent's ownership scope.
#
# In a monorepo with worktree-per-package, an `agent/<domain>/...`
# branch should only stage paths under `packages/<domain>/`, that
# package's tests, and possibly its README. A Domain Agent staging a
# cognition-layer file (PROTOCOLS.md, STATE.md, etc.) or another
# package's source is almost always an accident.
#
# Class: CANONICAL. Edit only via Governor proposal.
#
# Install: see hooks/install.md.

set -u

# Discover branch name. If we're not on an agent/* branch, skip.
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
case "$BRANCH" in
  agent/*) ;;
  *) exit 0 ;;
esac

# Extract domain from branch name: agent/<domain>/block-NNN-slug
DOMAIN=$(echo "$BRANCH" | sed -E 's|^agent/([^/]+)/.*$|\1|')
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "$BRANCH" ]; then
  exit 0
fi

mapfile -t STAGED < <(git diff --cached --name-only --diff-filter=ACMR || true)
if [ ${#STAGED[@]} -eq 0 ]; then
  exit 0
fi

SUSPECT=()
for f in "${STAGED[@]}"; do
  case "$f" in
    # Cognition layer — Governor's authority.
    PROTOCOLS.md|STATE.md|INDEX.md|CLAUDE.md|WORKSPACE_MAP.md|features.md|\
COGNITIVE_ARCHITECTURE.md|REPOSITORY_STRATEGY.md|DOMAIN_ARCHITECTURE.md|\
PARALLEL_IMPLEMENTATION.md|PHASE_PIPELINE.md|AGENT_OPERATING_MODEL.md|\
orchestrator.config.yaml|README.md|INIT_PROMPT.md)
      SUSPECT+=("$f")
      ;;
    protocols/*|templates/*|governance/*|.governor/*|orchestrator/*|\
phases/*|decisions/*)
      SUSPECT+=("$f")
      ;;
    # Another package than the one the branch names.
    packages/*)
      pkg=$(echo "$f" | sed -E 's|^packages/([^/]+)/.*$|\1|')
      if [ "$pkg" != "$DOMAIN" ] && [ "$DOMAIN" != "contracts" ]; then
        SUSPECT+=("$f")
      fi
      ;;
    apps/*)
      app=$(echo "$f" | sed -E 's|^apps/([^/]+)/.*$|\1|')
      if [ "$app" != "$DOMAIN" ]; then
        SUSPECT+=("$f")
      fi
      ;;
    infrastructure/*)
      if [ "$DOMAIN" != "db" ] && [ "$DOMAIN" != "devops" ]; then
        SUSPECT+=("$f")
      fi
      ;;
  esac
done

if [ ${#SUSPECT[@]} -eq 0 ]; then
  exit 0
fi

echo "" >&2
echo "pre-commit-capability: staged paths look out of scope for branch '$BRANCH'." >&2
echo "  The branch names domain '$DOMAIN'; expected scope is packages/$DOMAIN/** or similar." >&2
echo "" >&2
echo "Suspect paths:" >&2
for f in "${SUSPECT[@]}"; do
  echo "  - $f" >&2
done
echo "" >&2
echo "This hook is WARN-only — the commit will proceed." >&2
echo "If the edits are intentional (e.g., a coordinator block), commit again." >&2
echo "If unintended, run 'git reset HEAD <file>' to unstage." >&2

exit 0
