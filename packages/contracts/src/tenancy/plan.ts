/**
 * INVARIANT: Subscription tier per ADR-0005.
 *
 * Stable contract; the concrete numeric limits in {@link PlanLimit} are
 * operational tunables (changeable without an ADR), but the tier set
 * is a contract — adding/removing a tier requires an ADR.
 */
export type PlanTier = 'starter' | 'pro' | 'enterprise';

/**
 * INVARIANT: Per-tier hard resource caps per ADR-0005.
 *
 * Hard caps with no metered overage: when a tenant exceeds a cap,
 * `enforcePlanLimit` (in `packages/tenancy`) throws and the API maps
 * the error to HTTP 422. "Unlimited" is encoded as a numerically large
 * value, never `Infinity` (which does not serialize across JSON).
 */
export interface PlanLimit {
  readonly rowsPerMonth: number;
  readonly maxDashboards: number;
  readonly maxKpis: number;
  readonly maxErpConnections: number;
  readonly maxSeats: number;
}

/**
 * INVARIANT: Tenant's currently active subscription per ADR-0005.
 *
 * `validUntil` is `null` for the current paid plan; otherwise an ISO-8601
 * date string marking the end of an explicit term (trial expiry, downgrade
 * effective date). The producer (`packages/tenancy`) is the sole writer;
 * consumers treat this as read-only by contract and by the `readonly`
 * field modifiers.
 */
export interface Plan {
  readonly tier: PlanTier;
  readonly limits: PlanLimit;
  readonly validUntil: string | null;
}
