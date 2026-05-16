import { createLogger } from '@saas/observability';
import Fastify from 'fastify';

const log = createLogger('apps/api');

const app = Fastify({
  logger: false,
  trustProxy: true,
});

const STARTED_AT = Date.now();

app.get('/health', async (_req, reply) => {
  return reply.send({
    ok: true,
    version: process.env['APP_VERSION'] ?? 'dev',
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
  });
});

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '0.0.0.0';

app
  .listen({ port: PORT, host: HOST })
  .then((addr) => {
    log.info('api.started', { addr, port: PORT });
  })
  .catch((err: unknown) => {
    log.error('api.start.failed', {
      err: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  });
