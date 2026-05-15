# Manifest Template — Tier S (Spike / Small)

_Copy this file to `./manifests/active/block-NNN-<slug>.md`._
_Fill in fields. Commit pre-implementation._
_Tier S is for: investigation, single-file fix, lint sweep, doc-only changes._

---

# Block <NNN> — <Title>

- **Tier:** S
- **Kind:** investigation | implementation | refactor | migration
- **Domain:** <package or app this touches> (e.g., `packages/identity`)
- **Risk:** low
- **Performance-critical:** no
- **Parallel-with:** <block IDs this can run concurrently with; omit if none>
- **Status:** Pending
- **Axiom override:** <ID — justification; omit if none>
- **Feature:** <feature name from `./features.md`, if any; omit if none>

## 1. Purpose

One sentence describing the outcome.

## 2. Files

- Read: <list>
- Modify: <list>
- Create: <list>

## 3. Validation

How we know it's done. Examples:
- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm test` passes
- Finding document committed at `./findings/<slug>.md`

---

_Total size target: ≤ 500 B._
_If the block grows beyond 3 files modified, a new abstraction, or cross-domain impact, upgrade to Tier M before implementation._
