import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createLogger } from '@saas/observability';
import Fastify, { type FastifyInstance } from 'fastify';

const STARTED_AT = Date.now();

/**
 * Build a fully-routed Fastify instance. Caller decides whether to
 * `listen` (production entrypoint) or `inject` (in-process tests).
 *
 * INVARIANT: Fastify's built-in logger is disabled — log lines route
 * exclusively through `@saas/observability` per C3 (one way to do X).
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false, trustProxy: true });

  app.get('/health', () => ({
    ok: true,
    version: process.env['APP_VERSION'] ?? 'dev',
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
  }));

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
