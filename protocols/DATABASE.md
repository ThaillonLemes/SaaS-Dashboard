# Database Addendum

_Extends `./PROTOCOLS.md` with PostgreSQL + multi-tenancy rules. Loaded for any schema or query work._

---

## DB1 — PostgreSQL is the canonical store

All persistent application data lives in PostgreSQL. Caching layer is Redis
(for hot-path reads, rate limits, sessions). Other stores (S3 for files,
search engines) are added per-need, never as a default.

Reasoning: one DBMS reduces operational surface; Postgres covers transactional,
analytical, and JSON workloads adequately for SMB-scale SaaS.

---

## DB2 — Every table has a tenant scope

Per T1, every application table has a `tenant_id uuid NOT NULL` column.

Exceptions (cross-tenant infrastructure tables):
- `tenants` (the tenant registry itself)
- `users` (user identity, before tenant binding — see `tenancy` for tenant membership)
- `migrations` (schema version tracking)
- `system_<...>` tables (named with `system_` prefix to make the exception visible)

The Database Agent reviews every new table for T1 compliance. T1 is **never**
overridden.

---

## DB3 — Row-Level Security (RLS) is the safety net

Enable PostgreSQL RLS on every tenant-scoped table:

```sql
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON dashboards
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

App code sets `SET LOCAL app.tenant_id = '<uuid>'` at the start of each
request transaction. RLS enforces tenant isolation as a database-level
guarantee — application bugs cannot leak data across tenants.

Application code STILL passes `TenantContext` everywhere (defense in depth).

---

## DB4 — Migrations are append-only

- Migrations live in `infrastructure/db/migrations/<NNNN>-<slug>.sql` (or per the chosen migration tool's convention).
- Numbered sequentially. Never edit a committed migration.
- Each migration is paired with a forward script and a backward script (or marked irreversible with justification).
- Migrations run in CI before app deploy.

Schema changes that affect consumers are L-tier blocks with rollout plan
(per P2 — risky change). Examples:
- Renaming a column: 1) add new column, 2) backfill, 3) consumers switch, 4) drop old. Four blocks.
- Adding a NOT NULL column: 1) add nullable + default, 2) backfill, 3) tighten constraint. Three blocks.

---

## DB5 — Schema conventions

- **Table names:** plural snake_case (`tenants`, `dashboard_widgets`).
- **Column names:** snake_case (`tenant_id`, `created_at`).
- **Timestamps:** `created_at`, `updated_at` (timestamptz, never timestamp without tz).
- **Primary keys:** `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- **Foreign keys:** `<refstable_singular>_id` (e.g., `tenant_id`, `user_id`).
- **Indexes:** include `tenant_id` in every multi-column index that filters by tenant scope. RLS doesn't help if the planner picks a non-tenant index.
- **JSONB:** acceptable for variable-shape data (dashboard layout, mapping rules). Don't query inside JSONB on hot paths — promote to columns.

---

## DB6 — Query patterns

- **Always use parameterized queries.** No string concatenation. Even within the codebase, even with "trusted" input. SQL injection is a class of bug that the type system can prevent.
- **No `SELECT *`** in committed code. List columns explicitly.
- **Limits + pagination** on every list query. Cursor-based pagination for unbounded scans; offset for small, bounded UIs.
- **Transactions** around any multi-statement write. The repository method is the transaction boundary.

---

## DB7 — Query builder vs ORM

Choose ONE for the project:

| Tool | Use for |
|------|---------|
| **Drizzle ORM** | Type-safe, SQL-first, lightweight. Recommended. |
| **Kysely** | Pure query builder, very type-safe. Lower abstraction. |
| **Prisma** | More opinionated, generates a client; heavier. Skip unless team prefers. |
| **Raw SQL + pg** | OK for `apps/api` performance-critical paths; not idiomatic for repositories. |

Decision: **TBD at Phase 0 Block 002.** Probably Drizzle.

Whichever is chosen, it's the only one — no mixing within the project (C3).

---

## DB8 — Repository pattern

Each domain package exposes a repository module:

```ts
// packages/dashboard/src/repository.ts
export interface DashboardRepository {
  get(ctx: TenantContext, id: DashboardId): Promise<Dashboard | null>;
  create(ctx: TenantContext, def: DashboardCreate): Promise<Dashboard>;
  update(ctx: TenantContext, id: DashboardId, patch: DashboardPatch): Promise<Dashboard>;
  delete(ctx: TenantContext, id: DashboardId): Promise<void>;
  list(ctx: TenantContext, filter: DashboardFilter): Promise<Dashboard[]>;
}
```

- Repository methods receive `TenantContext` as the first argument.
- They open a DB transaction (or accept one) and set `SET LOCAL app.tenant_id`.
- They return domain types (from contracts), not raw row shapes.
- They never call another domain's repository — cross-domain reads go through the other domain's public surface.

---

## DB9 — Connection pooling

- One pool per app (`apps/api`, `apps/jobs`).
- Pool size tuned to environment (default 10, prod adjusted to load).
- Transactions use the pool's `withTransaction` helper.
- No long-held connections — release after the request.

---

## DB10 — Performance discipline

Per P4 — measure when it matters:

- Add indexes when a query plan shows seq-scan on a frequent path.
- Use `EXPLAIN ANALYZE` before claiming a query is slow.
- Cache hot reads in Redis (cache invalidation strategy declared per-cache in manifest).
- Don't N+1: domain code uses repository batch methods, not loops.

---

## DB11 — Backup and recovery

- Daily full backups.
- Point-in-time recovery enabled (PITR).
- Test recovery quarterly (Governor proposes).
- Backups stored in a different region than primary.

Operational rather than code concern — owned by Integration / DevOps Agent.

---

## DB12 — Observability

Every repository method emits:
- A trace span with operation name and tenant ID.
- A metric counter for query count.
- A metric histogram for query duration.

Standard via `packages/observability`:

```ts
import { withSpan, metrics } from '@app/observability';

export async function getDashboard(ctx: TenantContext, id: DashboardId) {
  return withSpan('dashboard.get', { tenantId: ctx.tenantId }, async () => {
    metrics.counter('dashboard_get_total', { tenantId: ctx.tenantId }).inc();
    // ... query
  });
}
```

---

## DB13 — Seed data and fixtures

- Dev / test seed data lives in `infrastructure/db/seeds/`.
- Seed scripts are idempotent (safe to run multiple times).
- Production never runs seed scripts. Production data is created via the app.

---

## DB14 — Tenant operations

Per T1, every tenant-scoped operation respects scope. The Database Agent
verifies new tables and new repository methods for compliance.

Tenant-creation operations are explicitly cross-tenant (they create the
tenant). They use `AdminContext`, audited in `audit/`.
