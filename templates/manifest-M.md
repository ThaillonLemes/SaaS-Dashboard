# Manifest Template — Tier M (Standard)

_Copy this file to `./manifests/active/block-NNN-<slug>.md`._
_Fill in fields. Commit pre-implementation._
_Tier M is the default for implementation blocks._

---

# Block <NNN> — <Title>

- **Tier:** M
- **Kind:** implementation | refactor | migration
- **Domain:** <package or app this touches>
- **Risk:** low | medium | high (drives whether P2 skeleton-first applies)
- **Performance-critical:** yes | no (drives whether P4 bench applies)
- **Parallel-with:** <block IDs; omit if none>
- **Depends-on:** <block IDs and contract names this depends on; omit if none>
- **Status:** Pending
- **Axiom override:** <ID — justification; omit if none>
- **Feature:** <feature name from `./features.md`, if any>

## 1. Purpose

One sentence.

## 2. Dependencies

Prior block IDs and contracts. Format:
- `Block <NNN>` for same-domain
- `<domain> Block <NNN>` for cross-domain
- `contract: @saas/contracts/<path>/<TypeName>` for contract dependencies

## 3. Files

- **Read:** <files this block reads for context>
- **Modify:** <files this block modifies>
- **Create:** <files this block creates>

## 4. Validation

Concrete validation gates. At minimum:
- `pnpm typecheck` passes
- `pnpm lint` passes
- `pnpm test` passes (unit + integration)
- Functional smoke (manual or scripted)

If the block touches DB schema: migration up + down + idempotency verified.
If the block touches API: OpenAPI spec regenerated.
If the block touches UI: visual review against design system.

## 5. Benchmarks (if Performance-critical: yes)

Named benches with target thresholds. Examples:
- `bench_<name>` p50 < <target>, p99 < <target>
- No regression > 5% vs prior baseline.

Skip section if `Performance-critical: no`.

## 6. Rollback signals

Conditions that force a revert. Examples:
- Type-check failure on `main`
- Test failure in CI
- Production error rate > threshold post-deploy

## 7. Expected outcomes

What changes after this block is integrated. Examples:
- New endpoint `POST /tenants/:tenantId/dashboards` available.
- New repository method `DashboardRepository.create(ctx, def)`.
- New contract type `DashboardCreate` exported from `@saas/contracts`.

## 8. Tenant safety check

Confirm:
- [ ] All new tables have `tenant_id` (or are documented cross-tenant).
- [ ] All new repository methods accept `TenantContext`.
- [ ] All new HTTP endpoints resolve `TenantContext` from path.
- [ ] All new logs / traces carry `tenantId`.
- [ ] N/A — block doesn't touch tenant-scoped data.

Per T1, never skip this section.

## 9. Cross-domain check

Confirm:
- [ ] No deep imports across packages (D1).
- [ ] Cross-domain types live in `packages/contracts/` (D2).
- [ ] No utility duplication (C3).
- [ ] N/A — block stays entirely within one package.

## 10. Risks

Risks and mitigations:
- **Risk:** <description>. **Mitigation:** <plan>.

## 11. Out of scope

Explicit deferrals. Things adjacent to this block that are NOT being done here
(prevents scope creep — C2).

## 12. New abstraction

If introducing a new utility, trait, generic, hook, or layer: name +
justification (satisfies C3 / Q1 Rule of Three).

If no new abstraction: write "None."

---

_Total size target: ≤ 5 KB._
_If the block needs cross-domain coordination, rollout planning, or activation criteria, upgrade to Tier L._
