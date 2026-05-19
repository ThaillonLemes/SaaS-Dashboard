-- 0002_identity_users.sql — users table for the identity domain.
--
-- The `users` table is cross-tenant infrastructure per
-- protocols/DATABASE.md §DB2 (a user identity exists before tenant binding;
-- per-tenant uniqueness is enforced by the composite UNIQUE constraint
-- below, while tenant membership lives in `packages/tenancy`).
--
-- Block 011 lands the schema only. RLS on tenant-scoped tables and the
-- `tenant_memberships` join table arrive in Phase 1B Block 018.

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id     TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);

-- DB: every tenant-filtered query starts with `WHERE tenant_id = $1` —
-- a standalone index on `tenant_id` keeps list/scan paths off the heap.
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);

-- Rollback:
--   DROP INDEX IF EXISTS users_tenant_idx;
--   DROP TABLE IF EXISTS users;
-- Reversible. `IF NOT EXISTS` makes forward application idempotent.
