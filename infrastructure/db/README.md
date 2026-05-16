# `infrastructure/db/` — PostgreSQL baseline + migrations

The single canonical place for **schema, migrations, and database
config** in the workspace. Owned by the Database Agent
(see [AGENT_OPERATING_MODEL.md](../../AGENT_OPERATING_MODEL.md:197)).

**Tool choice** is recorded in
[`decisions/ADR-0002-postgres-orm.md`](../../decisions/ADR-0002-postgres-orm.md):
**Drizzle ORM + `drizzle-kit`** for migrations, `pg` as the driver.
Per C3 ("one way to do X"), no other ORM, query builder, or migration
runner is used anywhere in the workspace.

---

## Layout

```
infrastructure/db/
├── README.md                  this file
├── drizzle.config.ts          drizzle-kit config (workspace single source)
├── schema.ts                  PHASE 1B BLOCK 018 — not yet present
├── migrations/
│   └── 0001_init.sql          bootstrap migration (pgcrypto enable)
└── seeds/                     created on demand; not yet present
```

- `schema.ts` is created by Phase 1B Block 018 when the first
  application tables land (`tenants`, `users`). Until then,
  drizzle-kit only runs `migrate` and `studio` — both tolerate
  the missing schema file.
- `seeds/` is created on demand when the first seed script appears.
  No `.gitkeep` is committed (keeps file count within the Tier-M
  manifest cap per C2).

---

## Local development workflow

### Start Postgres

From the workspace root:

```bash
cp .env.example .env             # first time only; edit POSTGRES_PASSWORD
docker compose up -d postgres
```

The container's healthcheck runs `pg_isready` every 5 seconds; expect
healthy state within ~10 seconds on a warm Docker daemon. Container
name: `saas-postgres`. Data volume: `saas-postgres-data` (persists
across `docker compose down`; remove with `docker volume rm
saas-postgres-data` for a clean slate).

### Apply migrations

```bash
pnpm exec drizzle-kit migrate --config infrastructure/db/drizzle.config.ts
```

drizzle-kit creates and maintains the `__drizzle_migrations`
bookkeeping table on first run, then executes any SQL file in
`migrations/` that hasn't already been applied. The command is
idempotent — running it twice is a no-op on the second pass.

### Inspect / debug

```bash
pnpm exec drizzle-kit studio --config infrastructure/db/drizzle.config.ts
```

Opens the Drizzle Studio UI on localhost:4983. Read-only-ish; safe to
run against the dev container. Do not run against production.

### Reset the local database

```bash
docker compose down
docker volume rm saas-postgres-data
docker compose up -d postgres
pnpm exec drizzle-kit migrate --config infrastructure/db/drizzle.config.ts
```

---

## Migration discipline

Per [protocols/DATABASE.md:53-63](../../protocols/DATABASE.md:53):

- **Append-only.** Never edit a committed migration. To fix a mistake,
  add a new migration that corrects it.
- **Numbered.** `<NNNN>_<slug>.sql`. drizzle-kit's `generate` command
  produces the next number automatically when the agent runs it
  against a changed `schema.ts`.
- **Paired.** Every migration carries a rollback section in its
  trailing comment block, OR is explicitly marked irreversible with
  justification (e.g., dropping a column we'll never want back). See
  `0001_init.sql` for the rollback-comment format.
- **Tool-managed bookkeeping is allowlisted.** The
  `__drizzle_migrations` table has no `tenant_id` column and is
  exempt from T1 / DB2 (it's cross-tenant infrastructure, per
  [protocols/DATABASE.md:22-27](../../protocols/DATABASE.md:22)).

drizzle-kit also supports `push` mode (apply schema-as-code directly
without generating a migration file). **Do not use `push` against any
shared environment.** It is dev-prototyping only; the production
contract is `generate` + reviewed SQL file + `migrate`.

---

## Tenant isolation — the RLS pattern

This block does NOT create any tenant-scoped tables. The pattern below
is documented here because **every Phase 1+ block that adds a
tenant-scoped table must apply it**, and the Database Agent reviews
new migrations against this template.

Per [protocols/TENANT.md:63-75](../../protocols/TENANT.md:63) and
[protocols/DATABASE.md:33-49](../../protocols/DATABASE.md:33):

### Schema requirement

Every tenant-scoped table has a non-null `tenant_id` column:

```sql
CREATE TABLE dashboards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

Exceptions (allowlisted cross-tenant infrastructure tables, per
[protocols/DATABASE.md:22-27](../../protocols/DATABASE.md:22)):
`tenants`, `users` (pre-binding), `migrations` / `__drizzle_migrations`,
and any table prefixed `system_`.

### RLS policy template

```sql
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;

-- TENANT: every read/write through normal app roles must match
-- current_setting('app.tenant_id'). RLS is the database-level safety
-- net behind the TypeScript TenantContext.
CREATE POLICY tenant_isolation ON dashboards
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);
```

`USING` filters reads; `WITH CHECK` filters writes. Both are required —
without `WITH CHECK`, a malicious update could move a row to a
different tenant.

### Request-time application code

App code sets the GUC at the start of every request transaction:

```ts
// pseudo-code; real implementation lands in packages/tenancy
await db.transaction(async (tx) => {
  // SECURITY: SET LOCAL scopes to this transaction only — never leaks
  // to other connections in the pool. Parameterized to prevent
  // injection from a compromised TenantContext.
  await tx.execute(sql`SET LOCAL app.tenant_id = ${ctx.tenantId}`);

  // Subsequent queries within tx are RLS-protected.
  return tx.select().from(dashboards).where(eq(dashboards.id, id));
});
```

Two independent layers guard tenant isolation (defense in depth, per
[protocols/TENANT.md:71-74](../../protocols/TENANT.md:71)):

1. **App layer.** Repositories accept `TenantContext`, scope every
   query by `tenant_id`, and refuse to operate without it.
2. **Database layer.** RLS rejects queries whose `app.tenant_id` GUC
   doesn't match the row's `tenant_id`.

A bug in one layer is caught by the other.

### Indexing under RLS

Per [protocols/DATABASE.md:73-74](../../protocols/DATABASE.md:73),
include `tenant_id` as the leading column of any multi-column index
that filters by tenant scope. RLS doesn't help if the planner picks a
non-tenant index and seq-scans the result.

```sql
CREATE INDEX dashboards_tenant_created_at
  ON dashboards (tenant_id, created_at DESC);
```

### Phase responsibility

- **Block 002 (this block):** documents the pattern; lands no
  tenant-scoped tables.
- **Phase 1A Block 005 (`identity` package skeleton):** lands the
  `users` table — explicitly cross-tenant per the allowlist; no RLS.
- **Phase 1B Block 018:** lands the `tenants` table and the
  `packages/tenancy` repository. From this point forward, every new
  tenant-scoped table in any later block must include the RLS policy
  block above.

---

## Connection pool

`pg` connection pooling configuration lands in `apps/api` and
`apps/jobs` when those shells are created (Block 007 / Phase 1+
respectively). Pool tuning per
[protocols/DATABASE.md:127-132](../../protocols/DATABASE.md:127):

- One pool per app.
- Default size 10; production tuned to load.
- No long-held connections — release after the request.
- Transactions go through the pool's `withTransaction` helper.

Block 002 does not create the pool.

---

## Production deployment

Per [ADR-0004-deploy.md](../../decisions/ADR-0004-deploy.md), production
Postgres is managed by the PaaS (Fly Postgres / Render Postgres /
AWS RDS). The Docker Compose service in this repo is **dev-only**.

Migrations run in CI before app deploy:

```bash
pnpm exec drizzle-kit migrate --config infrastructure/db/drizzle.config.ts
```

CI wiring lands in Block 009.

---

## References

- [decisions/ADR-0002-postgres-orm.md](../../decisions/ADR-0002-postgres-orm.md) — why Drizzle
- [decisions/ADR-0004-deploy.md](../../decisions/ADR-0004-deploy.md) — managed Postgres, no PaaS lock-in
- [protocols/DATABASE.md](../../protocols/DATABASE.md) — DB1-DB14 axioms
- [protocols/TENANT.md](../../protocols/TENANT.md) — RLS + `SET LOCAL` pattern, T1, T2
