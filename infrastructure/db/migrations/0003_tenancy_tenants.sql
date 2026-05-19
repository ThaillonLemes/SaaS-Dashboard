-- 0003_tenancy_tenants.sql — Phase 1B Block 018.
--
-- INVARIANT: First tenant-scoped infrastructure table. `tenants` is
-- itself cross-tenant infrastructure (per protocols/DATABASE.md:22-27
-- allowlist); it does NOT carry a `tenant_id` column and does NOT enable
-- RLS — RLS lands on the tenant-scoped tables Phase 1B+ introduces.
--
-- `deleted_at` is the soft-delete cursor per protocols/TENANT.md:177
-- (T-10 — audit-window retention before hard delete). Repository queries
-- in packages/tenancy exclude soft-deleted rows by default.

CREATE TABLE tenants (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  plan_tier   TEXT NOT NULL DEFAULT 'starter',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Rollback:
--   DROP TABLE IF EXISTS tenants;
-- Reversible during the block window; irreversible once Phase 1B
-- Block 019+ membership tables reference this via foreign key.
