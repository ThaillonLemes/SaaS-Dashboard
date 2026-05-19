import {
  IdentityError,
  type SessionToken,
  type TenantId,
  type UserId,
} from '@saas/contracts';

import { verifyPassword } from './password';
import { issueSessionToken } from './session';

/**
 * INVARIANT: Minimal user-lookup shape consumed by {@link loginUser}.
 *
 * The repository implementation lives in `apps/api` (Block 012) and is
 * built on Drizzle per ADR-0002; this interface lets the auth core
 * stay free of database driver imports (Q4 — locality of reasoning)
 * and lets tests stub a single function.
 */
export interface IdentityDb {
  findUserByEmail(
    tenantId: TenantId,
    email: string,
  ): Promise<{ id: UserId; passwordHash: string } | null>;
}

// SECURITY: Same message for "unknown email" and "wrong password" —
// returning distinguishable errors enables user enumeration (T3 +
// manifest §5). Never embed the looked-up email or hash in the
// message either.
const INVALID_CREDENTIALS_MESSAGE = 'invalid credentials';

/**
 * Authenticate `(email, password)` within `tenantId` and issue a
 * {@link SessionToken}.
 *
 * Throws `IdentityError('INVALID_CREDENTIALS')` on either an unknown
 * email or a password mismatch. Both branches take the same code path
 * shape and emit the same message — callers cannot tell them apart
 * (T3). On success returns a 24h-TTL JWT bound to the user and tenant.
 */
export async function loginUser(
  email: string,
  password: string,
  tenantId: TenantId,
  db: IdentityDb,
): Promise<SessionToken> {
  const user = await db.findUserByEmail(tenantId, email);
  if (user === null) {
    throw new IdentityError(
      'INVALID_CREDENTIALS',
      INVALID_CREDENTIALS_MESSAGE,
    );
  }
  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    throw new IdentityError(
      'INVALID_CREDENTIALS',
      INVALID_CREDENTIALS_MESSAGE,
    );
  }
  return issueSessionToken(user.id, tenantId);
}
