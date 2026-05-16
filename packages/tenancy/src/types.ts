/**
 * INVARIANT: Domain-error base for `packages/tenancy`.
 *
 * Every tenancy operation that throws raises this class with a stable
 * `code` discriminant. Phase 1B implementations extend the code set
 * additively (e.g. `'ROLE_INSUFFICIENT'`, `'PLAN_LIMIT_EXCEEDED'`);
 * the foundation skeleton uses `'NOT_IMPLEMENTED'` so consumers can
 * exercise the public surface without faking it out. Per TS4, errors
 * are thrown inside the package and converted to typed `Result` shapes
 * at cross-domain boundaries when Phase 1B lands the wiring.
 */
export class TenancyError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TenancyError';
    this.code = code;
  }
}

/**
 * INVARIANT: Plan-limit resource axis enforced by `enforcePlanLimit`.
 *
 * Each tag names exactly one field of {@link import('@saas/contracts').PlanLimit};
 * the tag set is the dual of the limit shape and must stay in sync with
 * ADR-0005. Adding a resource requires extending both `PlanLimit` (in
 * `packages/contracts`) and this union — an additive contract change
 * per D2.
 */
export type ResourceKind =
  | 'rowsPerMonth'
  | 'maxDashboards'
  | 'maxKpis'
  | 'maxErpConnections'
  | 'maxSeats';
