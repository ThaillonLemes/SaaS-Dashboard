# Tenant Safety Addendum

_Operationalizes axioms T1 and T2. Loaded for any code that touches tenant-scoped data — which is most code._

This is the most safety-critical addendum. A leak between tenants in a SaaS
is a security incident. **T1 is never overridden.**

---

## T-1 — `TenantContext` is the boundary

`TenantContext` is the type that says "this operation is acting on behalf of
this user in this tenant." It is created in exactly one place: `getTenantContext`
in `packages/tenancy`.

```ts
// packages/contracts/src/tenancy/context.ts
export interface TenantContext {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly roles: ReadonlyArray<Role>;
  readonly plan: Plan;
}
```

Every domain operation accepts `TenantContext` as its first argument (or
operates within a transaction that's been tenant-scoped via `SET LOCAL`).

A function that does NOT accept `TenantContext` is one of:
- A leaf utility (no I/O, no DB).
- A cross-tenant operation (in which case it accepts `AdminContext`).

Anything else is a bug.

---

## T-2 — `AdminContext` for cross-tenant operations

Some operations legitimately cross tenants:
- Listing all tenants (system admin).
- Migrating data during a tenant merge or transfer.
- Support tooling (debugging a customer issue).

These use `AdminContext`:

```ts
// packages/contracts/src/admin/context.ts
export interface AdminContext {
  readonly userId: UserId;          // who is the admin
  readonly reason: string;          // why this cross-tenant op (for audit)
  readonly auditId: string;         // audit log entry ID
}
```

Every `AdminContext` operation writes to the audit log (`packages/audit`).

`AdminContext` is **never** issued automatically. It's created only by:
- System processes (well-known, audited).
- Support tools with explicit user action and reason capture.

---

## T-3 — Database guarantees

Per `protocols/DATABASE.md`:

- Every tenant-scoped table has `tenant_id NOT NULL`.
- Row-Level Security policies enforce `tenant_id = current_setting('app.tenant_id')`.
- Each request opens a transaction and sets `app.tenant_id`.
- App bugs that forget to pass `TenantContext` are caught by RLS (no data returned, or 0 rows updated).

Defense in depth: app-layer (TypeScript) + RLS (Postgres). Two
independent layers must both fail for a leak to occur.

---

## T-4 — HTTP layer guarantees

Every HTTP handler:
1. Resolves `UserContext` from the bearer token.
2. Reads `tenantId` from the URL path (`/tenants/:tenantId/...`).
3. Calls `getTenantContext(userId, tenantId)` — which verifies membership.
4. Passes `TenantContext` to the service layer.

If `getTenantContext` throws (user not in tenant), the handler returns 403.

Routes that don't carry a `tenantId` in the path are either:
- Public (auth, sign-up, password reset).
- Cross-tenant admin (separately gated).

No route operates on a tenant resource without an explicit tenant ID in the
path.

---

## T-5 — Background jobs / queues

Jobs carry `tenantId` in their payload. The job handler:
1. Receives the job.
2. Reconstructs `TenantContext` (looking up the user or system actor).
3. Operates within that context.

A job without `tenantId` in its payload is either:
- A cross-tenant maintenance job (uses `AdminContext`).
- A bug.

No "global" jobs that touch tenant data.

---

## T-6 — Shared resources require per-tenant accounting

Per T2 (Tenant Fairness):

| Resource | Per-tenant accounting mechanism |
|----------|--------------------------------|
| Database connections | Pool is shared; per-tenant query timeouts |
| HTTP requests | Rate limits per tenant per endpoint class |
| Background jobs | Per-tenant queue weight (fair scheduling) |
| Storage (files, exports) | Per-tenant quota enforced before write |
| Memory caches | Per-tenant eviction or per-tenant key prefix with TTL |
| Compute (KPI aggregations, exports) | Per-tenant concurrency limit |

A new shared resource introduced without per-tenant accounting is a T2
violation. The block manifest names the mechanism.

---

## T-7 — Logging and observability

Every log line and trace span carries `tenantId` and `userId` (when available):

```ts
import { createLogger } from '@app/observability';

const log = createLogger('dashboard.service');

export async function createDashboard(ctx: TenantContext, def: DashboardCreate) {
  log.info('dashboard.create.start', { tenantId: ctx.tenantId, userId: ctx.userId });
  // ...
}
```

This makes per-tenant debugging possible and lets you compute per-tenant
metrics for fairness monitoring.

PII rules: do NOT log full email addresses, names, or other PII in production
logs. Hashed or truncated forms only. Field-level rules: see security guide
(to be authored Phase 3).

---

## T-8 — Cross-tenant API endpoints are explicit

If an endpoint needs to read data across tenants:
- The route is under `/admin/...` or `/system/...`.
- The middleware gates on admin role (separate from tenant role).
- Every call is audited.
- The endpoint accepts `AdminContext`, not `TenantContext`.

Mixing tenant and admin operations in the same handler is forbidden.

---

## T-9 — Testing tenant isolation

Every domain package has tests that:
- Create two tenants with separate data.
- Verify that operations in tenant A cannot read / write tenant B's data.
- Verify that an attempt returns the expected error (403 or empty result, depending on the API).

These tests are mandatory. CI runs them on every PR.

---

## T-10 — Tenant deletion (right to be forgotten)

When a tenant is deleted:
1. All tenant-scoped tables are filtered by `tenant_id` and rows are deleted.
2. Audit log entries are retained (compliance reasons) but anonymized.
3. The tenant record itself is marked deleted (soft delete) for an audit window, then hard-deleted.
4. External integrations (ERP connections, etc.) are revoked.

Tenant deletion is an L-tier block — affects the entire data model.

---

## T-11 — Multi-tenancy modes considered

The model above is **shared schema, shared database, tenant ID column +
RLS**. Reasons:
- Simplest to operate at SMB scale.
- Easiest cross-tenant analytics for the company itself (operational metrics).
- RLS as safety net.

Alternatives considered:
- **Schema-per-tenant.** Rejected: schema migrations multiply by tenant count.
- **Database-per-tenant.** Rejected: connection pool explosion; operational
  cost. Acceptable for enterprise white-label later, but not the default.
- **Cluster-per-tenant.** Rejected: only for the largest enterprise tier in
  the distant future.

The current model can graduate to enterprise modes per tenant if needed.
Foundation supports the graduation but doesn't pre-build it.

---

## T-12 — White-label / enterprise concerns

When a tenant becomes a white-label deployment:
- They may want a dedicated database (schema-per-tenant or DB-per-tenant).
- They may want custom branding (covered by `ui-kit` theming).
- They may want their own auth provider (SAML / OIDC — Phase 3 feature).
- They may want plugin / extension installation (Phase 4+).

These are evolution paths. The foundation supports them via the bounded
context model — each enterprise concern becomes its own package or
configuration without breaking shared-schema tenants.
