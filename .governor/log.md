# Governor private log

Append-only. Captures Governor-internal observations that don't belong in
the public `governance/log.md` (drafts, hypotheses, half-formed
analyses, post-mortem notes).

---

## 2026-05-15 — V3 install

Initial install. No prior history. Begin observations.

---

## 2026-05-15 — Scope rename + Phase 0 authoring

- `npm install` had to run in `orchestrator/` before doctor would pass. The foundation ships `package-lock.json` but not `node_modules/`. Noted in README onboarding step 3 already, but worth flagging in Block 001's manifest as "Validation" to ensure the agent re-runs install after touching `orchestrator/package.json` (rename + future bumps).
- Discovered a real foundation-level inconsistency: manifest templates (`templates/manifest-{S,M,L}.md`) describe a markdown-bullet format, but the orchestrator parser (`orchestrator/src/manifest/parse.ts`) expects YAML frontmatter delimited by `---`. The JSON schemas (`orchestrator/schemas/manifest-{S,M,L}.schema.yaml`) validate the YAML frontmatter. I wrote Phase 0 manifests with YAML frontmatter to satisfy the schema. The templates will need a Governor proposal to align — defer until Phase 0 lands.
- Tier-S schema rejects `kind: implementation`, only allowing `investigation | refactor`. PHASE_PIPELINE.md proposes Block 004 (contracts skeleton) as Tier S but it's creating files = implementation. I bumped it to Tier M. PHASE_PIPELINE.md's tier table is advisory; the schema is authoritative.
- PROTOCOLS.md is at 16426B post-v3 (was 16016B). INDEX.md says HOT cap is 14 KB. Doctor's threshold is more permissive (passed at 16 KB). Pre-existing — not introduced by me. Track for audit rule `04-hot-size-caps`.
- Block 004 scope expanded vs PHASE_PIPELINE.md spec: includes `TenantContext` interface alongside `TenantId`/`UserId`. Reason: `TenantContext` per protocols/TENANT.md belongs in `packages/contracts/`, and Block 006 (tenancy) shouldn't reach into contracts to define it (D1). Cleaner to ship all three types in the contracts skeleton.
