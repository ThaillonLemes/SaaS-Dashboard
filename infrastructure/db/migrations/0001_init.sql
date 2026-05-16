-- 0001_init.sql — bootstrap migration.
--
-- INVARIANT: This migration is intentionally minimal. drizzle-kit
-- manages its own bookkeeping table (`__drizzle_migrations`) on first
-- `drizzle-kit migrate` invocation; we do not pre-create it.
--
-- The block-002 manifest requires that the migration pipeline be
-- exercised end-to-end. This file's purpose is to be the first row in
-- `__drizzle_migrations` and to enable the `pgcrypto` extension that
-- subsequent migrations rely on for `gen_random_uuid()` (per
-- protocols/DATABASE.md:71 — UUID primary keys via gen_random_uuid()).
--
-- Application tables (tenants, users, dashboards, …) land in later
-- migrations authored by Phase 1A/1B blocks. Block 002 lands no
-- tenant-scoped tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Rollback:
--   DROP EXTENSION IF EXISTS "pgcrypto";
-- Reversible. `CREATE EXTENSION IF NOT EXISTS` is idempotent — running
-- this migration twice is a no-op on the second run.
