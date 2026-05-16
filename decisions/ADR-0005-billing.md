# ADR-0005: Billing — tier-based with usage caps

- **Status:** Accepted
- **Date:** 2026-05-15
- **Deciders:** Workspace Governor + user (bootstrap conversation, 2026-05-15)
- **Tags:** billing, tenancy, plan, packages/tenancy

## Context

The `packages/tenancy` skeleton (Phase 0 Block 006) defines the `Plan`
and `PlanLimit` types. The shape of these types decides what `tenancy`
can enforce at write time (per T2 — Tenant Fairness in
[protocols/TENANT.md:111-126](../protocols/TENANT.md:111)) and what
`packages/billing` (Phase 3) has to wire up against Stripe.

Decide the billing model now — not because Phase 3 is imminent (it's
far), but because the `Plan` type ships in Block 006 and its shape
constrains every downstream block's "is this tenant allowed to do X?"
check.

## Decision

**Tier-based with usage caps. Three tiers. Hard caps, no metered overage.**

### Tier shape

```ts
// In packages/contracts/src/tenancy/plan.ts (lands in Block 004 or Block 006)
export type PlanTier = 'starter' | 'pro' | 'enterprise';

export interface PlanLimit {
  rowsPerMonth: number;        // ERP rows ingested per calendar month
  maxDashboards: number;
  maxKpis: number;
  maxErpConnections: number;
  maxSeats: number;
}

export interface Plan {
  tier: PlanTier;
  limits: PlanLimit;
  validUntil: string | null;   // ISO date; null = no expiry (current paid plan)
}
```

Concrete tier values (operational, can change without an ADR — these
are tunables, not contracts):

| Tier | Rows/month | Dashboards | KPIs | ERP connections | Seats |
|------|-----------:|-----------:|-----:|----------------:|------:|
| `starter` | 100,000 | 3 | 10 | 1 | 3 |
| `pro` | 1,000,000 | 20 | 50 | 5 | 15 |
| `enterprise` | unlimited¹ | unlimited¹ | unlimited¹ | unlimited¹ | unlimited¹ |

¹ "Unlimited" = a numerically large cap (e.g., `Number.MAX_SAFE_INTEGER`).
Avoid `Infinity` in the type — it doesn't serialize cleanly across the JSON
boundary.

### Enforcement model

- `packages/tenancy` exposes `enforcePlanLimit(ctx, resource)` per
  [DOMAIN_ARCHITECTURE.md:96](../DOMAIN_ARCHITECTURE.md:96). Called from
  every endpoint that writes a tenant-scoped resource.
- Each consuming package (dashboard, analytics, integrations) calls
  `enforcePlanLimit` before write; on cap-exceeded it throws
  `TenantPlanLimitExceededError`, which the API maps to
  HTTP 422 `TENANT_PLAN_LIMIT_EXCEEDED`.
- Reads are never plan-gated. Caps apply to creation, not access.

### What this is NOT

- Not metered billing. A pro tenant who hits 1M rows in month X is
  blocked from further ingestion until next month, not billed for
  overage.
- Not per-seat granular billing. A pro tenant pays for "pro," not for
  N seats — caps just enforce that they stay under N.
- Not consumption-priced. Tier price is fixed per month; usage caps
  apply.

## Alternatives considered

### Alternative A: Per-seat via Stripe

- **Pros:** Simple to communicate. Stripe's bread and butter.
- **Cons:** Doesn't capture the value driver (data volume). A 3-seat
  tenant ingesting 5M rows pays the same as a 3-seat tenant ingesting
  100K rows.
- **Rejected because:** ERP analytics is fundamentally data-volume
  oriented; seats are a poor proxy for value.

### Alternative B: Free + paid with metered overage

- **Pros:** Maximizes monetization on power users. Aligns price with
  cost (compute / storage).
- **Cons:** Metering logic is complex (rate-counting; reconciliation
  with Stripe metered subscriptions; handling clock skew, dispute).
  Surprise bills are bad UX. Customers prefer predictable monthly cost.
- **Rejected because:** Engineering cost is real, customer-experience
  cost is real, and the SMB target market prefers predictable
  invoicing. May revisit at enterprise tier as a Phase 4+ ADR.

### Alternative C: Pure usage-based (per row ingested, per query)

- **Pros:** Most "fair" — pay for what you use.
- **Cons:** Hardest to price competitively. Customers can't budget.
  Every product decision becomes a billing decision.
- **Rejected because:** Bad fit for SMB ERP analytics; better suited to
  data warehousing platforms (Snowflake, BigQuery) where customers are
  technical buyers.

### Alternative D: Custom per-tenant pricing (sales-led only)

- **Pros:** Maximizes per-deal revenue.
- **Cons:** Requires a sales motion. Not a product-led-growth model.
- **Rejected because:** Solo founder selling to SMB; PLG is the right
  motion. Enterprise tier can layer custom pricing on top later (Phase
  4+) without changing this model.

## Consequences

### Positive

- `Plan` type is stable and ships in Block 006 (Phase 0).
- Enforcement model is simple: every write goes through one function;
  every consumer is a one-line addition.
- Customers can self-serve tier upgrades via Stripe Checkout when
  Phase 3 wires it up — no sales touch needed for starter → pro.
- Predictable revenue. ARR forecasting is straightforward.

### Negative

- A pro tenant who outgrows caps mid-month is blocked. The UX has to
  handle this gracefully (block-write 422 + clear in-product upsell to
  enterprise).
- "Unlimited" enterprise needs a soft-cap in practice (otherwise a
  single tenant can DoS the system). Phase 3 ADR-NNNN will add an
  internal soft-cap on enterprise + a manual override flag for "we
  approved this customer for X rows."

### Neutral / informational

- The concrete tier values (100k / 1M rows, 3 / 20 / unlimited
  dashboards, etc.) are **tunables**, not part of the ADR. Pricing
  experiments don't require a new ADR — they require a config change
  (Phase 3+ — when billing wires up).
- Free tier deliberately absent in v1. May add as a "trial" (14-day
  pro) when Phase 3 wires up. Decision deferred.

## Validation

How we'll know this was correct:

- **Conversion rate** (starter → pro within 6 months): target > 20% of
  active tenants. Below 10% suggests tier shape is wrong.
- **Cap-hit frequency:** % of writes that 422 on plan limit. < 1% = caps
  are loose (pricing too generous); > 5% = caps are tight (annoying UX).
  Target 1-3%.
- **Reconsideration trigger:** any of (a) customers consistently asking
  for usage-based, (b) overage-pricing competitive pressure forces a
  change, (c) enterprise deals require per-deal pricing more than 25%
  of the time.

## Implementation impact

- **New blocks required:** block-004 (or block-006) ships `Plan` /
  `PlanLimit` types in `packages/contracts`. Phase 3 will add
  `packages/billing` for Stripe integration.
- **Migrations required:** Phase 1B Block 018 (tenant table) carries a
  `plan_tier` column and a `plan_limits` JSONB column. Tier transitions
  Phase 3+.
- **Estimated effort:** S (skeleton in Phase 0), M (Stripe wiring in
  Phase 3).

## References

- [DOMAIN_ARCHITECTURE.md:81-103](../DOMAIN_ARCHITECTURE.md:81) — tenancy ownership and `enforcePlanLimit` surface
- [protocols/TENANT.md:111-126](../protocols/TENANT.md:111) — T2 (Tenant Fairness) accounting mechanisms
- Bootstrap conversation 2026-05-15 — user choice: per-tenant tier with usage caps
