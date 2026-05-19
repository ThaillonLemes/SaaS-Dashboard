import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TenantId, UserId } from '@saas/contracts';
import type { IdentityDb } from '@saas/identity';
import { createLogger } from '@saas/observability';
import Fastify, { type FastifyInstance } from 'fastify';
import { Pool } from 'pg';

import { authRoutes } from './routes/auth';

const STARTED_AT = Date.now();

declare module 'fastify' {
  interface FastifyInstance {
    db: IdentityDb;
  }
}

// WHY: lazy pool — only opened when auth is actually invoked (not at server
// construction time) so unit tests that inject a mock db never touch Postgres.
function createIdentityDb(connectionString: string): IdentityDb {
  let pool: Pool | undefined;
  return {
    async findUserByEmail(tenantId: TenantId, email: string) {
      pool ??= new Pool({ connectionString });
      const result = await pool.query<{ id: string; password_hash: string }>(
        'SELECT id, password_hash FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1',
        [tenantId, email],
      );
      const row = result.rows[0];
      return row === undefined
        ? null
        : { id: row.id as UserId, passwordHash: row.password_hash };
    },
  };
}

/**
 * Build a fully-routed Fastify instance. Caller decides whether to
 * `listen` (production entrypoint) or `inject` (in-process tests).
 *
 * INVARIANT: Fastify's built-in logger is disabled — log lines route
 * exclusively through `@saas/observability` per C3 (one way to do X).
 */
export function buildServer(options?: { db?: IdentityDb }): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: true });

  app.decorate(
    'db',
    options?.db ??
      createIdentityDb(process.env['DATABASE_URL'] ?? 'postgresql://localhost/saas'),
  );

  app.get('/health', () => ({
    ok: true,
    version: process.env['APP_VERSION'] ?? 'dev',
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
  }));

  void app.register(authRoutes);

  return app;
}

async function start(): Promise<void> {
  const log = createLogger('apps/api');
  const port = Number(process.env['PORT'] ?? 3000);
  const host = process.env['HOST'] ?? '0.0.0.0';

  const app = buildServer();
  try {
    const addr = await app.listen({ port, host });
    log.info('api.started', { addr, port });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('api.start.failed', { err: message });
    process.exit(1);
  }
}

// WHY: only listen when this module is the process entrypoint; tests import
// `buildServer` and must not trigger a real socket bind.
const entry = process.argv[1];
if (entry !== undefined && resolve(entry) === fileURLToPath(import.meta.url)) {
  await start();
}
