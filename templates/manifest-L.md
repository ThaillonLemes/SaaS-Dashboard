# Manifest Template — Tier L (Gate / Cross-Domain)

_Copy this file to `./manifests/active/block-NNN-<slug>.md`._
_Fill in all fields. Commit pre-implementation._
_Tier L is for: phase exit gates, cross-domain coordination, public API breaking changes, security blocks, contract migrations._

---

# Block <NNN> — <Title>

- **Tier:** L
- **Kind:** gate | implementation | refactor | migration
- **Domain:** <list all packages / apps affected>
- **Risk:** high (L-tier is by definition high-risk)
- **Performance-critical:** yes | no
- **Parallel-with:** rarely; L-tier blocks usually serialize
- **Depends-on:** <block IDs and contracts>
- **Status:** Pending
- **Axiom override:** <ID — justification; omit if none>
- **Feature:** <feature name from `./features.md`>

## 1. Purpose

One sentence.

## 2. Dependencies

Prior blocks and contracts.

## 3. Files

- **Read:** <list>
- **Modify:** <list>
- **Create:** <list>

## 4. Validation

Compile, lint, tests, conditional bench.

## 5. Benchmarks (if Performance-critical: yes)

Named benches.

## 6. Rollback signals

Conditions that force a revert.

## 7. Expected outcomes

What changes.

## 8. Tenant safety check

Per T1.

## 9. Cross-domain check

Per D1, D2.

## 10. Cross-Domain Impact

Other packages affected by this block:
- **Package:** <name>. **Files:** <list>. **Migration order:** <description>.
- For contract changes: list every consumer package that imports the affected types and the follow-up block per consumer.

## 11. Rollout Plan

How the change is deployed:
- Step 1: <land code with flag / additive only>
- Step 2: <verify in dev / staging>
- Step 3: <ramp to production behind feature flag>
- Step 4: <flip flag on / remove old code path>

For schema changes: list each phase of the multi-step migration.

## 12. Activation criteria (for gate blocks)

Quantitative pass/fail criteria. Goes into the phase's `exit.md`. Each:
- **Name:** <metric or behavior>
- **Threshold:** <quantitative target>
- **Measurement:** <how it's measured>
- **Evidence:** <where the result lives — log path, test output, dashboard>
- **Pass / Fail:** <stamped at gate evaluation>

## 13. Risks

Risks and mitigations.

## 14. Out of scope

Explicit deferrals.

## 15. New abstraction

If introducing a new utility, layer, or pattern: name + justification.

## 16. Communication plan

L-tier blocks affect multiple domains. Names of agents / domains to notify
before / during / after. Update `./features.md` if applicable.

---

_Total size target: ≤ 8 KB._
_L-tier manifests are reviewed by the Governor before block start to verify cross-domain coordination is sound._
