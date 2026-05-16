import { afterEach, describe, expect, it } from 'vitest';

import { buildServer } from '../src/index';

interface HealthBody {
  readonly ok: boolean;
  readonly version: string;
  readonly uptime: number;
}

describe('GET /health', () => {
  const originalVersion = process.env['APP_VERSION'];

  afterEach(() => {
    if (originalVersion === undefined) delete process.env['APP_VERSION'];
    else process.env['APP_VERSION'] = originalVersion;
  });

  it('returns 200 with { ok: true, version, uptime }', async () => {
    const app = buildServer();
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });

      expect(res.statusCode).toBe(200);

      const body = res.json<HealthBody>();
      expect(body.ok).toBe(true);
      expect(typeof body.version).toBe('string');
      expect(typeof body.uptime).toBe('number');
      expect(Number.isInteger(body.uptime)).toBe(true);
      expect(body.uptime).toBeGreaterThanOrEqual(0);
    } finally {
      await app.close();
    }
  });

  it('falls back to "dev" when APP_VERSION is unset', async () => {
    delete process.env['APP_VERSION'];
    const app = buildServer();
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.json<HealthBody>().version).toBe('dev');
    } finally {
      await app.close();
    }
  });

  it('reflects APP_VERSION when set', async () => {
    process.env['APP_VERSION'] = 'v1.2.3';
    const app = buildServer();
    try {
      const res = await app.inject({ method: 'GET', url: '/health' });
      expect(res.json<HealthBody>().version).toBe('v1.2.3');
    } finally {
      await app.close();
    }
  });
});
