import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * INVARIANT: Drizzle table definition for `tenants`, mirroring
 * `infrastructure/db/migrations/0003_tenancy_tenants.sql`.
 *
 * The `tenants` table is cross-tenant infrastructure (per
 * `protocols/DATABASE.md:22-27` allowlist) — it does NOT carry a
 * `tenant_id` column and is NOT under RLS. RLS arrives on the
 * tenant-scoped tables added in later Phase 1B blocks (memberships,
 * roles, etc.).
 *
 * `id` is `TEXT` (not `uuid`) so the application can mint IDs without
 * a round-trip when the manifest calls for it; the database supplies
 * `gen_random_uuid()::text` as the default for app-side `INSERT`s that
 * omit it.
 */
export const tenants = pgTable('tenants', {
  id: text('id')
    .primaryKey()
    .default(sql`gen_random_uuid()::text`),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  planTier: text('plan_tier').notNull().default('starter'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});
