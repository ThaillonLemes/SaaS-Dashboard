import {
  IdentityError,
  type TenantId,
  type UserId,
} from '@saas/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  hashPassword,
  loginUser,
  parseSessionToken,
  verifyPassword,
  type IdentityDb,
} from '../src/index';

const TENANT = 'tenant-aaa' as TenantId;
const USER = 'user-001' as UserId;
const EMAIL = 'alice@example.com';
const PASSWORD = 'correct horse battery staple';

function stubDb(
  user: { id: UserId; passwordHash: string } | null,
): IdentityDb {
  return {
    findUserByEmail: () => Promise.resolve(user),
  };
}

describe('password', () => {
  it('hashPassword + verifyPassword round-trip', async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash).not.toBe(PASSWORD);
    expect(await verifyPassword(PASSWORD, hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('loginUser', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env['SESSION_SECRET'];
    process.env['SESSION_SECRET'] = 'test-secret-do-not-use-in-prod';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env['SESSION_SECRET'];
    } else {
      process.env['SESSION_SECRET'] = originalSecret;
    }
  });

  it('returns a session token on correct credentials', async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const db = stubDb({ id: USER, passwordHash });

    const token = await loginUser(EMAIL, PASSWORD, TENANT, db);

    expect(typeof token).toBe('string');
    const claims = parseSessionToken(token);
    expect(claims).toEqual({ userId: USER, tenantId: TENANT });
  });

  it('throws INVALID_CREDENTIALS on wrong password', async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const db = stubDb({ id: USER, passwordHash });

    await expect(loginUser(EMAIL, 'wrong-password', TENANT, db))
      .rejects.toBeInstanceOf(IdentityError);
    await expect(loginUser(EMAIL, 'wrong-password', TENANT, db))
      .rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('throws INVALID_CREDENTIALS on unknown email (no enumeration)', async () => {
    const db = stubDb(null);

    const wrongPwHash = await hashPassword(PASSWORD);
    const existingDb = stubDb({ id: USER, passwordHash: wrongPwHash });

    let unknownErr: IdentityError | null = null;
    let wrongPwErr: IdentityError | null = null;
    try {
      await loginUser('unknown@example.com', PASSWORD, TENANT, db);
    } catch (e) {
      unknownErr = e as IdentityError;
    }
    try {
      await loginUser(EMAIL, 'wrong-password', TENANT, existingDb);
    } catch (e) {
      wrongPwErr = e as IdentityError;
    }

    expect(unknownErr).toBeInstanceOf(IdentityError);
    expect(wrongPwErr).toBeInstanceOf(IdentityError);
    // T3: the two failure modes must be indistinguishable to the caller.
    expect(unknownErr?.code).toBe(wrongPwErr?.code);
    expect(unknownErr?.message).toBe(wrongPwErr?.message);
  });

  it('passes the tenantId to the user lookup (no cross-tenant)', async () => {
    let observedTenant: TenantId | null = null;
    const db: IdentityDb = {
      findUserByEmail: (tenantId) => {
        observedTenant = tenantId;
        return Promise.resolve(null);
      },
    };

    await expect(loginUser(EMAIL, PASSWORD, TENANT, db))
      .rejects.toBeInstanceOf(IdentityError);
    expect(observedTenant).toBe(TENANT);
  });
});
