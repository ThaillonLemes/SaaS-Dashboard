import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { TenantId } from '@saas/contracts';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTenant,
  getTenantById,
  getTenantBySlug,
  softDeleteTenant,
  tenants,
  type DrizzleDb,
} from '../src/index';

const migrationUrl = new URL(
  '../../../infrastructure/db/migrations/0003_tenancy_tenants.sql',
  import.meta.url,
);

const loadMigration = async (): Promise<string> =>
  readFile(fileURLToPath(migrationUrl), 'utf8');

interface Harness {
  readonly client: PGlite;
  readonly db: DrizzleDb;
}

const makeHarness = async (): Promise<Harness> => {
  const client = new PGlite();
  // WHY: pglite ships pgcrypto built-in; we replay the migration's
  // `CREATE TABLE` to mirror the production schema without depending
  // on drizzle-kit's bookkeeping layer (which expects its own
  // metadata header on top of each SQL file).
  const migrationSql = await loadMigration();
  await client.exec(migrationSql);
  // WHY: cast to the production-aligned DrizzleDb. PgliteDatabase and
  // NodePgDatabase share the same PgDatabase query-builder surface;
  // only the QueryResultHKT phantom parameter differs, and the
  // runtime call shape is identical for the four methods under test.
  const db = drizzle(client, { schema: { tenants } }) as unknown as DrizzleDb;
  return { client, db };
};

describe('tenancy repository', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await makeHarness();
  });

  afterEach(async () => {
    await harness.client.close();
  });

  it('createTenant + getTenantById round-trips the row', async () => {
    const created = await createTenant(
      { slug: 'acme', name: 'Acme Inc.' },
      harness.db,
    );

    expect(created.slug).toBe('acme');
    expect(created.name).toBe('Acme Inc.');
    expect(created.planTier).toBe('starter');
    expect(created.deletedAt).toBeNull();
    expect(created.id).toMatch(/.+/);

    const fetched = await getTenantById(created.id, harness.db);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.slug).toBe('acme');
    expect(fetched?.name).toBe('Acme Inc.');
  });

  it('getTenantBySlug returns null for an unknown slug', async () => {
    const fetched = await getTenantBySlug('does-not-exist', harness.db);
    expect(fetched).toBeNull();
  });

  it('getTenantBySlug returns the tenant for a known slug', async () => {
    await createTenant(
      { slug: 'globex', name: 'Globex Corp.' },
      harness.db,
    );

    const fetched = await getTenantBySlug('globex', harness.db);
    expect(fetched).not.toBeNull();
    expect(fetched?.slug).toBe('globex');
    expect(fetched?.name).toBe('Globex Corp.');
  });

  it('soft-deleted tenant is hidden from getTenantById and getTenantBySlug', async () => {
    const created = await createTenant(
      { slug: 'initech', name: 'Initech' },
      harness.db,
    );

    await softDeleteTenant(created.id, harness.db);

    expect(await getTenantById(created.id, harness.db)).toBeNull();
    expect(await getTenantBySlug('initech', harness.db)).toBeNull();
  });

  it('respects caller-supplied id and planTier on create', async () => {
    const customId = 'tenant-fixed-001' as TenantId;
    const created = await createTenant(
      { id: customId, slug: 'stark', name: 'Stark Industries', planTier: 'pro' },
      harness.db,
    );

    expect(created.id).toBe(customId);
    expect(created.planTier).toBe('pro');

    const fetched = await getTenantById(customId, harness.db);
    expect(fetched?.planTier).toBe('pro');
  });
});
