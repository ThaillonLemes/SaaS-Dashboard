# ADR-0002: Postgres tooling — Drizzle ORM + drizzle-kit migrations

- **Status:** Accepted
- **Date:** 2026-05-16
- **Deciders:** Database Agent (block-002) + Workspace Governor
- **Tags:** database, infrastructure, tooling

## Context

Block 001 landed the monorepo skeleton (pnpm + turbo + TS strict). Block
002 must land the Postgres development environment plus the workspace's
single database tool — a query builder / ORM, plus a migration runner.
Every downstream package (`identity`, `tenancy`, `analytics`,
`dashboard`, `integrations`, `normalization`) builds its repository
layer on whatever this block picks. The choice is consequential
and high-fanout, so it deserves an ADR.

The workspace constraints already in place from earlier decisions:

- **C3 — one way to do X.** Only one DB tool in the workspace. No
  mixing Drizzle-in-one-package + Prisma-in-another.
- **TypeScript strict mode** with seven extra flags (per
  [protocols/TYPESCRIPT.md](../protocols/TYPESCRIPT.md)). The chosen
  tool must typecheck cleanly under this configuration.
- **T1 — tenant safety.** Every tenant-scoped table will carry a
  `tenant_id` column with PostgreSQL Row-Level Security. The tool must
  not make the RLS pattern awkward — in particular, it must allow
  setting `SET LOCAL app.tenant_id` inside the same transaction as the
  query, and it must not interfere with policy-protected reads.
- **ADR-0004 — managed Postgres, no PaaS lock-in.** The tool must talk
  standard Postgres-over-TCP. No platform-specific drivers, no
  Postgres-fork dialects.
- **P5 — independently revertible.** Schema changes are append-only
  migrations (per [protocols/DATABASE.md:53-63](../protocols/DATABASE.md:53)).
  The tool's migration mechanism must support paired forward / backward
  scripts (or explicit irreversibility justification).

The decision boils down to three serious contenders:
[Drizzle ORM](https://orm.drizzle.team), [Kysely](https://kysely.dev),
and [Prisma](https://www.prisma.io).
[protocols/DATABASE.md:88-100](../protocols/DATABASE.md:88) calls out
Drizzle as the default with the choice deferred to Block 002 — this ADR
either ratifies that default or overrides it with cause.

## Decision

**Drizzle ORM with the `pg` driver, migrations via `drizzle-kit`.**

Concretely:

| Concern | Choice |
|---------|--------|
| Query builder / ORM | `drizzle-orm` ≥ 0.36.x |
| Driver | `pg` (node-postgres) + `@types/pg` |
| Migration tool | `drizzle-kit` ≥ 0.30.x |
| Schema location | `infrastructure/db/schema.ts` (Phase 1B Block 018 onwards) |
| Migration location | `infrastructure/db/migrations/<NNNN>_<slug>.sql` |
| Bookkeeping table | `__drizzle_migrations` (managed by drizzle-kit; allowlisted infra table) |
| Config file | `infrastructure/db/drizzle.config.ts` |
| Dialect | `postgresql` (no other dialect ever) |
| Postgres major | `16` (pinned in `docker-compose.yml`; matches modern managed-PG defaults) |

Phase 1B Block 018 will land the `tenants` and `users` tables in
`schema.ts`, enable RLS, and define the `tenant_isolation` policy per
[protocols/TENANT.md:63-75](../protocols/TENANT.md:63). Block 002
documents that pattern but does not yet apply it — schema definition
belongs to the domain blocks that own the tables.

## Alternatives considered

### Alternative A: Kysely (pure query builder)

- **Pros:**
  - Cleanest TypeScript story of the three — query types are derived
    directly from the schema type, no decorators, no codegen.
  - Lightweight: a single dependency, no migration tool included
    (would pair with `kysely-migration-cli` or a hand-rolled runner).
  - Closest to raw SQL — query shape stays predictable; no "magic"
    relation eager-loading layer.
- **Cons:**
  - No batteries-included migration tool. We'd need a second
    dependency (`kysely-migration-cli`) or write our own runner —
    extra surface to maintain, extra ADR.
  - No automatic schema introspection or migration generation —
    every migration is hand-written. Tolerable for a small schema,
    expensive at the 20-table point.
  - Smaller ecosystem; fewer Stack Overflow / AI-training-data hits
    than Drizzle.
- **Rejected because:** for a SaaS with ≥ 6 domain packages and an
  evolving schema, the missing migration generator is a recurring tax
  that pays no dividend. We accept slightly more "ORM-ish" abstraction
  in exchange for `drizzle-kit generate` / `drizzle-kit push`.

### Alternative B: Prisma

- **Pros:**
  - The most polished DX: schema-first DSL, fully generated typed
    client, built-in migration tool, mature studio UI.
  - Strong autocomplete on relations and includes.
  - Largest community among the three.
- **Cons:**
  - Schema is defined in `schema.prisma`, a separate DSL — not
    TypeScript. The DSL is a parallel source of truth that doesn't
    compose with the rest of the codebase.
  - The generated client is a `node_modules`-resident artifact. Code
    in `packages/*` that uses Prisma binds to a generated module —
    awkward for D1 (Domain Isolation) reasoning.
  - Prisma's transaction model historically struggles with
    `SET LOCAL` (it manages its own transaction lifecycle through
    `$transaction` / interactive transactions). Setting
    `app.tenant_id` per-request inside the transaction is doable but
    finicky — there are open issues on Prisma's tracker about
    `SET LOCAL` semantics under interactive transactions.
  - Heavier: Prisma Engine binary (~30MB) shipped with the app
    image, separate query engine process, more moving parts.
  - Migration tool (`prisma migrate`) tightly couples the migration
    history to the Prisma schema file. Less ergonomic if we ever
    need to mix raw-SQL migrations (RLS policy creation,
    extension installs, function definitions) with schema-generated
    ones.
- **Rejected because:** the dual source of truth (`schema.prisma` vs
  TypeScript types), the RLS+transaction friction, and the engine
  weight all argue against it for our specific
  multi-tenant + RLS-first architecture. Prisma is excellent for
  schema-first CRUD; we're SQL-first by axiom (DB6, DB7) and
  RLS-protected by axiom (T1, DB3).

### Alternative C: TypeORM

- **Pros:** Long-running, batteries-included, active-record + data-mapper modes.
- **Cons:** Decorators-heavy; type inference is the weakest of any
  serious option; release cadence has wobbled. Out of step with the
  protocols (Q2: types carry invariants — decorator metadata is a
  weaker carrier than function-derived types).
- **Rejected because:** the type story is materially worse than the
  other three, and the ecosystem has moved on. Not seriously
  considered.

### Alternative D: Raw `pg` only (no ORM, no query builder)

- **Pros:** No abstraction. No tool to learn. Pure SQL.
- **Cons:** No compile-time guarantee that the query column list
  matches the row shape we destructure into. Every result row must be
  hand-validated at the boundary or trusted unsafely. Migrations would
  need a third-party runner anyway.
- **Rejected because:** Q2 says types carry invariants. A raw `pg`
  query returning `QueryResult<any>` either pushes validation cost into
  every repository method or, more realistically, becomes a stealth
  source of `any`-typed rows. Acceptable as an escape hatch for
  performance-critical paths (DB7 explicitly allows it) but not as the
  default repository layer.

## Consequences

### Positive

- **Single source of truth for schema in TypeScript.** Phase 1B's
  `schema.ts` is the only place table shapes are declared; query
  result types flow from that declaration. Q2 (types carry invariants)
  upheld at zero runtime cost.
- **`drizzle-kit generate` produces a SQL diff** between the schema
  and the migration history, which we commit verbatim. The committed
  migration is the canonical artifact — the schema-as-code generates
  it, but reviewers read SQL. This sidesteps "generated-only" ORM
  workflows where the SQL is implicit.
- **Raw-SQL escape hatch** is first-class (`db.execute(sql\`...\`)`),
  which we'll need for: RLS policy creation (`CREATE POLICY ...`),
  `SET LOCAL app.tenant_id`, `EXPLAIN ANALYZE` invocations during
  performance work (P4).
- **Standard `pg` driver** under the hood — same connection pool, same
  failure modes, same observability hooks (`pg-pool` events) as if
  we'd written raw SQL. ADR-0004's portability constraint (no
  PaaS-specific persistence) is upheld trivially.
- **Migration directory is plain SQL files.** Reviewers, DBAs, and
  future tooling (e.g., `pg-osc` for zero-downtime alters) can read
  them without the tool installed. Less lock-in than a tool with a
  proprietary migration format.

### Negative

- **drizzle-kit's `push` mode (apply schema directly without a
  migration file) is tempting and footgun-shaped** in shared
  environments. We document `drizzle-kit generate` + manual review +
  `drizzle-kit migrate` as the production-path flow;
  `drizzle-kit push` is dev-only.
- **Drizzle is younger than Prisma / Kysely.** Some sharp edges remain
  (intermittent breaking changes in 0.x releases, less Stack Overflow
  coverage). Pin minor versions and review release notes per upgrade
  block.
- **Drizzle's relations API** is more verbose than Prisma's
  `include`-style eager loading. For complex aggregate queries (which
  the analytics package will eventually have), we fall back to raw
  SQL via `db.execute(sql\`...\`)`. This is fine — the analytics
  layer was always going to be SQL-heavy.

### Neutral / informational

- **The bookkeeping table `__drizzle_migrations` is allowlisted
  infrastructure**, per [protocols/DATABASE.md:22-27](../protocols/DATABASE.md:22).
  No `tenant_id` column. Documented in `infrastructure/db/README.md`.
- **Postgres major version pinned to 16** in `docker-compose.yml`.
  This matches the default for Fly Postgres / Render Postgres / AWS
  RDS as of Q2 2026. ADR-NNNN supersedes when we upgrade.

## Validation

How we'll know this was correct:

- **Phase 1B Block 018 lands `tenants` + `users` + RLS policies in
  ≤ 1 day of agent time.** If the policy creation or `SET LOCAL`
  pattern hits Drizzle-shaped friction worse than raw SQL would, we
  re-evaluate.
- **Type-check / lint stays clean on the Drizzle imports under
  TypeScript strict + 7 extra flags.** Block 002 verifies this on
  the drizzle.config.ts; later blocks verify on `schema.ts`.
- **Reconsideration trigger:** Drizzle 1.0 ships with a
  breaking-changes manifest we can't absorb in one block; OR an open
  GitHub issue blocks RLS-with-`SET LOCAL` for ≥ 30 days; OR Postgres
  16 → 17 reveals a Drizzle compatibility gap that lasts ≥ 1 release.

## Implementation impact

- **New blocks required:** block-002 (this block — scaffolding, config
  file, bootstrap migration). Phase 1B Block 018 lands the first real
  schema.
- **Migrations required:** `0001_init.sql` (bootstrap; intentionally
  minimal — drizzle-kit creates `__drizzle_migrations` on first
  `drizzle-kit migrate`).
- **Estimated effort:** M (this block; ~1 day agent time).

## References

- [protocols/DATABASE.md](../protocols/DATABASE.md) — DB1-DB14, sets RLS + repository pattern requirements
- [protocols/TENANT.md](../protocols/TENANT.md) — T1, T2, RLS + `SET LOCAL` pattern
- [ADR-0001-monorepo.md](ADR-0001-monorepo.md) — tooling stack this builds on
- [ADR-0004-deploy.md](ADR-0004-deploy.md) — portability constraint (no PaaS-specific persistence)
- [Drizzle ORM documentation](https://orm.drizzle.team)
- [drizzle-kit migrations guide](https://orm.drizzle.team/kit-docs/overview)
- [node-postgres (pg)](https://node-postgres.com)
