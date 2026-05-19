import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { PGlite } from '@electric-sql/pglite';
import type { TenantId } from '@saas/contracts';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  deactivateConnection,
  erpConnections,
  getConnection,
  saveConnection,
  type DrizzleDb,
} from '../src/connection';

const loadMigration = async (filename: string): Promise<string> => {
  const url = new URL(
    `../../../infrastructure/db/migrations/${filename}`,
    import.meta.url,
  );
  return readFile(fileURLToPath(url), 'utf8');
};

interface Harness {
  readonly client: PGlite;
  readonly db: DrizzleDb;
  readonly tenantId: TenantId;
}

const makeHarness = async (): Promise<Harness> => {
  const client = new PGlite();
  // WHY: pglite ships pgcrypto built-in. We replay both migrations to
  // mirror the production schema — tenants first (FK target), then
  // erp_connections (FK source).
  const tenantSql = await loadMigration('0003_tenancy_tenants.sql');
  const connectionSql = await loadMigration('0007_integrations_connections.sql');
  await client.exec(tenantSql);
  await client.exec(connectionSql);
  // Seed a tenant row to satisfy the FK constraint.
  await client.exec(
    `INSERT INTO tenants (id, slug, name, plan_tier)
     VALUES ('t-test-001', 'acme', 'Acme Inc.', 'starter')`,
  );
  const tenantId = 't-test-001' as TenantId;
  // WHY: PgliteDatabase and NodePgDatabase share the same query-builder
  // surface; only the phantom HKT differs. Cast mirrors the pattern in
  // packages/tenancy/__tests__/repository.test.ts.
  const db = drizzle(client, {
    schema: { erpConnections },
  }) as unknown as DrizzleDb;
  return { client, db, tenantId };
};

describe('integrations connection', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await makeHarness();
  });

  afterEach(async () => {
    await harness.client.close();
  });

  it('saveConnection + getConnection round-trips the row', async () => {
    const config = {
      tenantId: harness.tenantId,
      credentials: { apiKey: 'secret-abc' },
      baseUrl: 'https://erp.example.com',
    };

    await saveConnection(harness.tenantId, 'cisspoder', config, harness.db);

    const fetched = await getConnection(harness.tenantId, 'cisspoder', harness.db);
    expect(fetched).not.toBeNull();
    expect(fetched?.tenantId).toBe(harness.tenantId);
    expect(fetched?.credentials).toEqual({ apiKey: 'secret-abc' });
    expect(fetched?.baseUrl).toBe('https://erp.example.com');
  });

  it('getConnection returns null for unknown connector', async () => {
    const result = await getConnection(
      harness.tenantId,
      'no-such-connector',
      harness.db,
    );
    expect(result).toBeNull();
  });

  it('deactivateConnection sets active = false, hiding the row from getConnection', async () => {
    const config = {
      tenantId: harness.tenantId,
      credentials: { token: 'tok-xyz' },
    };

    await saveConnection(harness.tenantId, 'cisspoder', config, harness.db);
    await deactivateConnection(harness.tenantId, 'cisspoder', harness.db);

    const fetched = await getConnection(harness.tenantId, 'cisspoder', harness.db);
    expect(fetched).toBeNull();
  });
});
