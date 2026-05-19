import type { TenantId } from '@saas/contracts';
import { and, eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import type { ConnectorConfig } from './connector';

/**
 * Drizzle schema for `erp_connections`, mirroring
 * `infrastructure/db/migrations/0007_integrations_connections.sql`.
 *
 * INVARIANT: `tenantId` is the partition key — all three repository
 * functions scope every query by it (T1, protocols/TENANT.md).
 * `credentials` is JSONB and never passed to logs or metrics.
 */
export const erpConnections = pgTable('erp_connections', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  tenantId: text('tenant_id').notNull(),
  connectorName: text('connector_name').notNull(),
  credentials: jsonb('credentials').notNull().$type<Record<string, string>>(),
  baseUrl: text('base_url'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * INVARIANT: Drizzle DB handle accepted by every function in this module.
 *
 * Schema-parameterized so query result types flow from the table
 * declaration (Q2). Consumers in `apps/api` / `apps/jobs` construct
 * one via `drizzle(pgPool, { schema })`. Test code substitutes a
 * PGlite-backed handle of the same shape (same pattern as
 * `packages/tenancy`).
 */
export type DrizzleDb = NodePgDatabase<{
  erpConnections: typeof erpConnections;
}>;

/**
 * Persist or overwrite the connection config for `(tenantId, connectorName)`.
 *
 * Upserts on the `UNIQUE(tenant_id, connector_name)` constraint so
 * callers can re-save updated credentials without a prior delete (T1 —
 * the row always belongs to exactly one tenant).
 */
export async function saveConnection(
  tenantId: TenantId,
  connectorName: string,
  config: ConnectorConfig,
  db: DrizzleDb,
): Promise<void> {
  await db
    .insert(erpConnections)
    .values({
      tenantId,
      connectorName,
      credentials: config.credentials,
      baseUrl: config.baseUrl ?? null,
      active: true,
    })
    .onConflictDoUpdate({
      target: [erpConnections.tenantId, erpConnections.connectorName],
      set: {
        credentials: config.credentials,
        baseUrl: config.baseUrl ?? null,
        active: true,
      },
    });
}

/**
 * Retrieve the active connection config for `(tenantId, connectorName)`.
 *
 * Returns `null` when no active row exists — either because the
 * connector was never configured or was deactivated via
 * {@link deactivateConnection}.
 */
export async function getConnection(
  tenantId: TenantId,
  connectorName: string,
  db: DrizzleDb,
): Promise<ConnectorConfig | null> {
  const rows = await db
    .select()
    .from(erpConnections)
    .where(
      and(
        eq(erpConnections.tenantId, tenantId),
        eq(erpConnections.connectorName, connectorName),
        eq(erpConnections.active, true),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (row === undefined) return null;

  const config: ConnectorConfig = {
    // WHY: text() columns return string; TenantId brand is a compile-time
    // invariant that is not recoverable from the DB wire type.
    tenantId: row.tenantId as TenantId,
    credentials: row.credentials,
  };
  if (row.baseUrl !== null) {
    return { ...config, baseUrl: row.baseUrl };
  }
  return config;
}

/**
 * Soft-deactivate the connection for `(tenantId, connectorName)`.
 *
 * Sets `active = false`; the row is retained for audit history. A
 * subsequent {@link getConnection} call returns `null` for the same pair.
 * Idempotent: deactivating an already-inactive row is a no-op UPDATE.
 */
export async function deactivateConnection(
  tenantId: TenantId,
  connectorName: string,
  db: DrizzleDb,
): Promise<void> {
  await db
    .update(erpConnections)
    .set({ active: false })
    .where(
      and(
        eq(erpConnections.tenantId, tenantId),
        eq(erpConnections.connectorName, connectorName),
      ),
    );
}
