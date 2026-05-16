---
id: block-002-postgres-baseline
tier: M
kind: implementation
phase: Phase 0 — Foundation
scope: phase-bound
status: Complete
domain: infrastructure/db
risk: medium
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/DATABASE.md
    - protocols/TENANT.md
    - decisions/ADR-0001-monorepo.md
    - decisions/ADR-0004-deploy.md
    - templates/adr-template.md
  modify:
    - package.json
  create:
    - decisions/ADR-0002-postgres-orm.md
    - infrastructure/db/README.md
    - infrastructure/db/migrations/0001_init.sql
    - infrastructure/db/drizzle.config.ts
    - docker-compose.yml
    - .env.example
benchmarks: []
flags: []
metrics: []
---

# Block 002 — Postgres baseline + ORM tooling

## 1. Purpose

Establish the Postgres development environment (Docker), the migration
tool (Drizzle expected; agent picks via ADR-0002), and the directory
layout under `infrastructure/db/`. The block lands no application tables
— `tenants` and `users` come in Phase 1A/1B. This block lands the
**scaffolding** plus a trivial bootstrap migration so the migration tool
itself is exercised end-to-end.

## 2. Dependencies

- Block 001 (root tooling, workspace must be ready for `pnpm add`).

## 3. Scope

### ADR-0002 (authored in this block)

Pick **Drizzle** vs Kysely vs Prisma. Defaults to Drizzle per
[protocols/DATABASE.md:88](../../protocols/DATABASE.md:88) unless the
agent identifies a blocker. Document trade-offs.

### `docker-compose.yml` (root)

Single service: `postgres:16-alpine`. Healthcheck. Volume for data.
Port `5432` exposed to localhost. Default DB `saas_dev`, user `saas`,
password from `.env`.

### `.env.example`

Documents required env vars: `DATABASE_URL`, `NODE_ENV`. Production
deploys override via PaaS secrets (per ADR-0004).

### `infrastructure/db/`

```
infrastructure/db/
├── README.md                 — how to run migrations, local pg, seeds (when added)
├── migrations/
│   └── 0001_init.sql        — bootstrap migration
└── drizzle.config.ts        — Drizzle config (if Drizzle chosen)
```

`seeds/` directory is created on demand when the first seed is needed;
no `.gitkeep` shipped here (keeps file count within the Tier-M cap).

The `0001_init.sql` migration creates whatever bookkeeping table the
chosen ORM needs. Drizzle uses `__drizzle_migrations`. If Drizzle is the
ORM, the tool creates it on first `drizzle-kit push`, so the SQL file
might just have `-- intentionally empty; drizzle manages its own table`.
Either way, the migration runs idempotently.

### Root `package.json` modification

Add the chosen ORM + migration tool to root `devDependencies` via:

```
pnpm add -Dw drizzle-kit drizzle-orm pg @types/pg
```

(Or chosen-tool equivalents if ADR-0002 picks Kysely or Prisma.)

This is the ONLY root-file modify in this block. No new pnpm scripts
needed at root — database commands run as `pnpm exec drizzle-kit <cmd>`,
documented in `infrastructure/db/README.md`.

`pnpm-lock.yaml` will be modified as a side effect of the install
(same pattern as Block 001). The lockfile is a generated artifact and
not declared as an explicit manifest modify.

## 4. Validation

- `pnpm install` succeeds after adding drizzle-kit + drizzle-orm + pg + @types/pg.
- `docker compose up -d postgres` starts a healthy Postgres container.
- `pnpm exec drizzle-kit <migrate-equivalent>` applies migrations
  cleanly on a fresh DB.
- Migration is idempotent — running twice produces the same state, no
  errors.
- Migration is paired with an explicit rollback (or marked irreversible
  with justification in `infrastructure/db/README.md`).
- `.env.example` documents every required var; `.env` is gitignored
  (already covered by Block 001's .gitignore additions).
- `pnpm turbo run typecheck` exits 0.
- `pnpm exec eslint .eslintrc.cjs` clean.
- `governor doctor` PASS 10/10 post-block.
- Tenant-isolation pattern documented in `infrastructure/db/README.md`:
  RLS policy template + `SET LOCAL app.tenant_id` request pattern.

## 5. Rollback signals

- Migration fails on a clean DB.
- `docker compose up postgres` doesn't pass healthcheck within 30s.
- Chosen ORM doesn't typecheck cleanly with Phase 0's `tsconfig.base.json`
  strictness settings.

## 6. Expected outcomes

After integration:
- `pnpm db:up && pnpm db:migrate` brings up a working local Postgres
  with bookkeeping schema.
- `infrastructure/db/migrations/` is the canonical place for every
  future schema change (Phase 1+).
- ADR-0002 records the ORM choice with rejected alternatives.

## 7. Tenant safety check

- [x] N/A — block doesn't create tenant-scoped tables. Documents the
      RLS + `SET LOCAL` pattern for Phase 1+ blocks; doesn't yet apply
      it.

## 8. Cross-domain check

- [x] No deep imports across packages (D1) — no packages exist yet.
- [x] No utility duplication (C3) — ORM choice is recorded in ADR;
      single tool for the whole workspace per C3 ("one way to do X").

## 9. Risks

- **Risk:** Drizzle doesn't support some PG feature Phase 1+ needs (e.g., RLS policy DSL). **Mitigation:** Drizzle has raw SQL escape hatch; document the pattern in README.
- **Risk:** Local Postgres version drifts from PaaS production version. **Mitigation:** Pin Postgres major version (16) in docker-compose; ADR-0002 records.
- **Risk:** Migration tool's bookkeeping table conflicts with the cross-tenant infrastructure-table allowlist in [protocols/DATABASE.md:22-27](../../protocols/DATABASE.md:22). **Mitigation:** Bookkeeping is the migration tool's own table; document it as an allowlisted infrastructure table (`__drizzle_migrations` or equivalent).

## 10. Out of scope

- Application tables (`tenants`, `users`, etc. — Phase 1A/1B).
- Production deploy of Postgres (Block 009 wires CI deploy; actual PaaS
  Postgres provisioning is operator action).
- RLS policy *creation* — Block 002 documents the pattern; Phase 1B
  Block 018 applies it.
- Connection pool tuning (Phase 1+).

## 11. New abstraction

If the agent introduces a `db()` factory or repository base class in
`infrastructure/db/` — no. That belongs in domain packages. Block 002
is just tooling + the SQL migration directory.

If the chosen ORM has a config file that introduces patterns
(`drizzle.config.ts`), that's not an abstraction — it's tool config.
