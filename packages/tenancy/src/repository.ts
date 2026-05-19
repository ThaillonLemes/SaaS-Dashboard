import type { NewTenant, PlanTier, Tenant, TenantId } from '@saas/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { tenants } from './schema';

/**
 * INVARIANT: Drizzle DB handle this repository accepts.
 *
 * Schema-parameterized so query result types flow from the table
 * declaration (Q2). Consumers in `apps/api` / `apps/jobs` construct
 * one via `drizzle(pgPool, { schema })` per ADR-0002. Test code
 * substitutes a PGlite-backed handle of the same shape.
 */
export type DrizzleDb = NodePgDatabase<{ tenants: typeof tenants }>;

type TenantRow = typeof tenants.$inferSelect;

const toTenant = (row: TenantRow): Tenant => ({
  id: row.id as TenantId,
  slug: row.slug,
  name: row.name,
  planTier: row.planTier as PlanTier,
  createdAt: row.createdAt,
  deletedAt: row.deletedAt,
});

/**
 * Look up a tenant by primary key, excluding soft-deleted rows.
 *
 * @returns The {@link Tenant} when present and not soft-deleted; `null`
 *   when the row does not exist OR has been soft-deleted (T-10 audit
 *   window — caller treats both cases as "gone").
 */
export async function getTenantById(
  id: TenantId,
  db: DrizzleDb,
): Promise<Tenant | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.id, id), isNull(tenants.deletedAt)))
    .limit(1);
  const row = rows[0];
  return row === undefined ? null : toTenant(row);
}

/**
 * Look up a tenant by URL slug, excluding soft-deleted rows.
 *
 * INVARIANT: `slug` is the user-facing tenant identifier (e.g.,
 * `acme-corp` in `https://app.example.com/acme-corp/...`). The unique
 * constraint at the database level guarantees at most one live row
 * per slug; the `isNull(deletedAt)` predicate ensures a freshly
 * created tenant can reuse a slug whose previous holder has been
 * hard-deleted but not one still inside the soft-delete window.
 */
export async function getTenantBySlug(
  slug: string,
  db: DrizzleDb,
): Promise<Tenant | null> {
  const rows = await db
    .select()
    .from(tenants)
    .where(and(eq(tenants.slug, slug), isNull(tenants.deletedAt)))
    .limit(1);
  const row = rows[0];
  return row === undefined ? null : toTenant(row);
}

/**
 * Insert a new tenant row.
 *
 * INVARIANT: `id`, `planTier`, and `createdAt` are optional in
 * {@link NewTenant} and default at the database level — omitting them
 * is the common case (the database mints the UUID via
 * `gen_random_uuid()::text` per migration `0003`). `deletedAt` is
 * never accepted on create; a tenant born soft-deleted is a bug.
 */
export async function createTenant(
  data: NewTenant,
  db: DrizzleDb,
): Promise<Tenant> {
  const insertValues: typeof tenants.$inferInsert = {
    slug: data.slug,
    name: data.name,
    ...(data.id !== undefined ? { id: data.id } : {}),
    ...(data.planTier !== undefined ? { planTier: data.planTier } : {}),
  };

  const rows = await db.insert(tenants).values(insertValues).returning();
  const row = rows[0];
  if (row === undefined) {
    throw new Error('createTenant: insert returned no rows');
  }
  return toTenant(row);
}

/**
 * Soft-delete a tenant by stamping `deletedAt` with the current time.
 *
 * INVARIANT: Soft delete preserves the audit trail per T-10
 * (`protocols/TENANT.md:177`). Subsequent reads from
 * {@link getTenantById} / {@link getTenantBySlug} return `null` for
 * the soft-deleted tenant; hard delete (and the slug release that
 * comes with it) is a later block's concern.
 *
 * Idempotent: stamping `deletedAt` on an already soft-deleted tenant
 * is a no-op-shaped UPDATE — the row's `deletedAt` advances to the
 * new timestamp but the visible state ("gone") does not change.
 */
export async function softDeleteTenant(
  id: TenantId,
  db: DrizzleDb,
): Promise<void> {
  await db
    .update(tenants)
    .set({ deletedAt: new Date() })
    .where(eq(tenants.id, id));
}
