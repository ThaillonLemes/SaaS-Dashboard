import Fastify, { type FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildApp(): FastifyInstance {
  const STARTED_AT = Date.now();

  const app = Fastify({ logger: false, trustProxy: true });

  app.get('/health', async (_req, reply) => {
    return reply.send({
      ok: true,
      version: process.env['APP_VERSION'] ?? 'dev',
      uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
    });
  });

  return app;
}

describe('GET /health', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
  });

  it('returns ok: true, a string version, and a non-negative integer uptime', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    const body: unknown = JSON.parse(response.body);

    expect(body).toMatchObject({ ok: true });

    const typed = body as { ok: boolean; version: unknown; uptime: unknown };
    expect(typeof typed.version).toBe('string');
    expect(typeof typed.uptime).toBe('number');
    expect(Number.isInteger(typed.uptime)).toBe(true);
    expect((typed.uptime as number) >= 0).toBe(true);
  });

  it('defaults version to "dev" when APP_VERSION is not set', async () => {
    const saved = process.env['APP_VERSION'];
    delete process.env['APP_VERSION'];

    try {
      const response = await app.inject({ method: 'GET', url: '/health' });
      const body = JSON.parse(response.body) as { version: string };
      expect(body.version).toBe('dev');
    } finally {
      if (saved !== undefined) {
        process.env['APP_VERSION'] = saved;
      }
    }
  });

  it('reflects APP_VERSION env var in the response', async () => {
    const saved = process.env['APP_VERSION'];
    process.env['APP_VERSION'] = '1.2.3';

    try {
      const appWithVersion = buildApp();
      await appWithVersion.ready();
      const response = await appWithVersion.inject({
        method: 'GET',
        url: '/health',
      });
      const body = JSON.parse(response.body) as { version: string };
      expect(body.version).toBe('1.2.3');
      await appWithVersion.close();
    } finally {
      if (saved !== undefined) {
        process.env['APP_VERSION'] = saved;
      } else {
        delete process.env['APP_VERSION'];
      }
    }
  });
});
