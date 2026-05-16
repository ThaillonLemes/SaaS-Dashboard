import { describe, expect, it } from 'vitest';

import type { Email, UserId } from '@saas/contracts';

import {
  AuthError,
  authenticate,
  revokeSession,
  validateSession,
  type Credentials,
  type Session,
  type UserContext,
} from '../src/index';

describe('AuthError', () => {
  it('carries its code and message and identifies as AuthError', () => {
    const err = new AuthError('NOT_IMPLEMENTED', 'demo');

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthError);
    expect(err.name).toBe('AuthError');
    expect(err.code).toBe('NOT_IMPLEMENTED');
    expect(err.message).toBe('demo');
  });
});

describe('Phase 0 stubs', () => {
  // WHY: branding cannot be constructed from string literals at runtime, so
  // tests cast through `unknown` once to fabricate `Credentials`. Production
  // code constructs `Email` only via the (future) validator at the boundary.
  const fakeCreds = {
    email: 'a@b.co' as unknown as Email,
    password: 'pw',
  } satisfies Credentials;

  it('authenticate() rejects with AuthError NOT_IMPLEMENTED', async () => {
    await expect(authenticate(fakeCreds)).rejects.toBeInstanceOf(AuthError);
    await expect(authenticate(fakeCreds)).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
  });

  it('validateSession() rejects with AuthError NOT_IMPLEMENTED', async () => {
    await expect(validateSession('any-token')).rejects.toBeInstanceOf(
      AuthError,
    );
    await expect(validateSession('any-token')).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
  });

  it('revokeSession() rejects with AuthError NOT_IMPLEMENTED', async () => {
    await expect(revokeSession('any-id')).rejects.toBeInstanceOf(AuthError);
    await expect(revokeSession('any-id')).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
  });
});

describe('public-surface type shape', () => {
  it('Session, UserContext, Credentials carry contracts-branded fields', () => {
    const userId = 'u-1' as unknown as UserId;
    const email = 'a@b.co' as unknown as Email;

    const session: Session = {
      token: 'tok',
      userId,
      expiresAt: '2026-05-16T00:00:00Z',
    };
    const userCtx: UserContext = { userId, email };
    const creds: Credentials = { email, password: 'pw' };

    expect(session.userId).toBe(userId);
    expect(userCtx.email).toBe(email);
    expect(creds.email).toBe(email);
  });
});
