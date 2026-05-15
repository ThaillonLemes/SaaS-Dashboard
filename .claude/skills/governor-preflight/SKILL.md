---
name: governor-preflight
description: Run `governor preflight <manifest>` — full JSON Schema validation + dependency lookup + file-scope conflict check for a new block manifest. Use immediately after authoring a manifest, before the block starts. Outputs `governance/preflight-<block-id>.md`.
---

# /governor-preflight

You are validating a fresh block manifest before authorizing the block.
Goal: confirm the manifest's frontmatter passes JSON Schema, all named
dependencies exist, and no file scope conflicts with another active
block.

## Pre-read

1. `STATE.md` — confirm the package is free per the single-writer rule.
2. The manifest itself (the path the user gave you).

## Execute

```bash
cd orchestrator
npx tsx bin/governor.ts preflight <relative-path-to-manifest>
```

Then read `governance/preflight-<block-id>.md`.

## Report

1. **Verdict in one line:** "READY" (0 errors) or "BLOCKED" (N errors,
   M warnings).
2. **For each error:** category (`schema`, `dependency`, `scope`) and
   the failure message.
3. **For warnings:** brief mention; don't block on warnings.
4. **Recommendation:** if READY, the block can start. If BLOCKED, list
   the fixes the manifest author must make.

## Notes

- Three check categories:
  - **schema** — frontmatter doesn't validate against
    `orchestrator/schemas/manifest-<tier>.schema.yaml`.
  - **dependency** — a block ID in `dependencies:` doesn't exist (or
    isn't `Complete`).
  - **scope** — a file in `files.modify` or `files.create` is also
    claimed by another active manifest.
- Exit code: 0 = READY, 2 = BLOCKED.
- `governance/preflight-<block-id>.md` is OPERATIONAL — regeneratable.
