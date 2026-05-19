import type { SessionToken, TenantId, UserId } from '@saas/contracts';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { issueSessionToken, parseSessionToken } from '../src/index';

const TENANT = 'tenant-zzz' as TenantId;
const USER = 'user-042' as UserId;

describe('session tokens', () => {
  let originalSecret: string | undefined;

  beforeEach(() => {
    originalSecret = process.env['SESSION_SECRET'];
    process.env['SESSION_SECRET'] = 'unit-test-secret';
  });

  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env['SESSION_SECRET'];
    } else {
      process.env['SESSION_SECRET'] = originalSecret;
    }
  });

  it('issueSessionToken + parseSessionToken round-trip', () => {
    const token = issueSessionToken(USER, TENANT);
    const claims = parseSessionToken(token);
    expect(claims).toEqual({ userId: USER, tenantId: TENANT });
  });

  it('parseSessionToken returns null on a tampered token', () => {
    const token = issueSessionToken(USER, TENANT);
    const tampered = `${token}x` as SessionToken;
    expect(parseSessionToken(tampered)).toBeNull();
  });

  it('parseSessionToken returns null on a token signed with a different secret', () => {
    const foreign = jwt.sign(
      { sub: USER, tid: TENANT },
      'a-different-secret',
      { algorithm: 'HS256', expiresIn: 60 * 60 * 24 },
    ) as SessionToken;
    expect(parseSessionToken(foreign)).toBeNull();
  });

  it('parseSessionToken returns null on an expired token', () => {
    // WHY: forge the JWT directly with a past exp so the test runs in
    // milliseconds — issueSessionToken's 24h TTL is too long to wait out.
    const expired = jwt.sign(
      { sub: USER, tid: TENANT },
      'unit-test-secret',
      { algorithm: 'HS256', expiresIn: -1 },
    ) as SessionToken;
    expect(parseSessionToken(expired)).toBeNull();
  });

  it('throws if SESSION_SECRET is missing when issuing', () => {
    delete process.env['SESSION_SECRET'];
    expect(() => issueSessionToken(USER, TENANT)).toThrow(
      /SESSION_SECRET/,
    );
  });
});
