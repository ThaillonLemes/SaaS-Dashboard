import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { UserId } from '@saas/contracts';
import type { IdentityDb } from '@saas/identity';
import { createLogger } from '@saas/observability';
import Fastify, { type FastifyInstance } from 'fastify';
import { Pool } from 'pg';

import { authRoutes } from './routes/auth';

declare module 'fastify' {
  interface FastifyInstance {
    db?: IdentityDb;
  }
}

const STARTED_AT = Date.now();

/**
 * Build a fully-routed Fastify instance. Caller decides whether to
 * `listen` (production entrypoint) or `inject` (in-process tests).
 *
 * INVARIANT: Fastify's built-in logger is disabled — log lines route
 * exclusively through `@saas/observability` per C3 (one way to do X).
 */
export function buildServer(db?: IdentityDb): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: true });

  if (db !== undefined) {
    app.decorate('db', db);
  }

  app.get('/health', () => ({
    ok: true,
    version: process.env['APP_VERSION'] ?? 'dev',
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
  }));

  void app.register(authRoutes);

  return app;
}

function createDbFromEnv(): IdentityDb {
  const url = process.env['DATABASE_URL'];
  if (!url) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: url });
  return {
    async findUserByEmail(tenantId, email) {
      const result = await pool.query<{
        id: string;
        password_hash: string;
      }>(
        'SELECT id, password_hash FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1',
        [tenantId, email],
      );
      const row = result.rows[0];
      if (row === undefined) return null;
      return { id: row.id as UserId, passwordHash: row.password_hash };
    },
  };
}

async function start(): Promise<void> {
  const log = createLogger('apps/api');
  const port = Number(process.env['PORT'] ?? 3000);
  const host = process.env['HOST'] ?? '0.0.0.0';

  const db = createDbFromEnv();
  const app = buildServer(db);
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
