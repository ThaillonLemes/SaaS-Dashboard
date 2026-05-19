import type { TenantId, UserId } from '@saas/contracts';
import { hashPassword } from '@saas/identity';
import type { IdentityDb } from '@saas/identity';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildServer } from '../src/index';

const TENANT = 'tenant-test-001' as TenantId;
const USER = 'user-test-001' as UserId;
const EMAIL = 'alice@example.com';
const PASSWORD = 'correct horse battery staple';

function stubDb(
  user: { id: UserId; passwordHash: string } | null,
): IdentityDb {
  return {
    findUserByEmail: () => Promise.resolve(user),
  };
}

describe('POST /login', () => {
  let passwordHash: string;
  let originalSecret: string | undefined;

  beforeEach(async () => {
    originalSecret = process.env['SESSION_SECRET'];
    process.env['SESSION_SECRET'] = 'test-secret-do-not-use-in-prod';
    passwordHash = await hashPassword(PASSWORD);
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env['SESSION_SECRET'];
    } else {
      process.env['SESSION_SECRET'] = originalSecret;
    }
  });

  it('returns 200 with a token on valid credentials', async () => {
    const db = stubDb({ id: USER, passwordHash });
    const app = buildServer(db);
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
    const db = stubDb({ id: USER, passwordHash });
    const app = buildServer(db);
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: EMAIL,
          password: 'wrong-password',
          tenantId: TENANT,
        },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<{ error: string }>();
      expect(body.error).toBe('Invalid credentials');
    } finally {
      await app.close();
    }
  });

  it('returns 401 on unknown email (no enumeration)', async () => {
    const db = stubDb(null);
    const app = buildServer(db);
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: {
          email: 'unknown@example.com',
          password: PASSWORD,
          tenantId: TENANT,
        },
      });

      expect(res.statusCode).toBe(401);
      const body = res.json<{ error: string }>();
      expect(body.error).toBe('Invalid credentials');
    } finally {
      await app.close();
    }
  });

  it('returns 400 when email is missing', async () => {
    const db = stubDb({ id: USER, passwordHash });
    const app = buildServer(db);
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { password: PASSWORD, tenantId: TENANT },
      });

      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('returns 400 when password is missing', async () => {
    const db = stubDb({ id: USER, passwordHash });
    const app = buildServer(db);
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: EMAIL, tenantId: TENANT },
      });

      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });

  it('returns 400 when tenantId is missing', async () => {
    const db = stubDb({ id: USER, passwordHash });
    const app = buildServer(db);
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/login',
        payload: { email: EMAIL, password: PASSWORD },
      });

      expect(res.statusCode).toBe(400);
    } finally {
      await app.close();
    }
  });
});
