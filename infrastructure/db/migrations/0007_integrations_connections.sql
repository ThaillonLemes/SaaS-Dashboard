-- 0007_integrations_connections.sql — Phase 1C Block 026.
--
-- INVARIANT: Tenant-scoped ERP connection records (T1). One row per
-- (tenant_id, connector_name) holds the credentials and base URL needed
-- to initialize an ErpConnector at runtime (block-025). The UNIQUE
-- constraint enforces a single config per connector per tenant;
-- `active = false` soft-deactivates without losing audit history.
--
-- `credentials` is JSONB — never queried inside, never logged
-- (protocols/TENANT.md security requirement).

CREATE TABLE erp_connections (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id),
  connector_name TEXT NOT NULL,
  credentials    JSONB NOT NULL,
  base_url       TEXT,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, connector_name)
);

-- Rollback:
--   DROP TABLE IF EXISTS erp_connections;
-- Reversible during block-026 window; irreversible once block-027+
-- inserts connector rows into this table.
