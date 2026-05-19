import type { TenantId, UserId } from '@saas/contracts';
import { hashPassword, type IdentityDb } from '@saas/identity';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildServer } from '../src/index';

const TENANT = 'tenant-test' as TenantId;
const USER = 'user-001' as UserId;
const EMAIL = 'alice@example.com';
const PASSWORD = 'correct-horse-battery-staple';

function makeDb(user: { id: UserId; passwordHash: string } | null): IdentityDb {
  return {
    findUserByEmail: () => Promise.resolve(user),
  };
}

describe('POST /login', () => {
  const originalSecret = process.env['SESSION_SECRET'];

  beforeEach(() => {
    process.env['SESSION_SECRET'] = 'test-secret-do-not-use-in-prod';
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env['SESSION_SECRET'];
    else process.env['SESSION_SECRET'] = originalSecret;
  });

  it('returns 200 + token on valid credentials', async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const app = buildServer({ db: makeDb({ id: USER, passwordHash }) });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: EMAIL, password: PASSWORD, tenantId: TENANT },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ token: string }>();
      expect(typeof body.token).toBe('string');
      expect(body.token.length).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  it('returns 401 on wrong password', async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const app = buildServer({ db: makeDb({ id: USER, passwordHash }) });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: EMAIL, password: 'wrong-password', tenantId: TENANT },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json<{ error: string }>().error).toBe('Invalid credentials');
    } finally {
      await app.close();
    }
  });

  it('returns 400 on missing required fields', async () => {
    const app = buildServer({ db: makeDb(null) });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: EMAIL },
      });
      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
