import type { TenantId, UserId } from '@saas/contracts';
import { describe, expect, it } from 'vitest';

import { TenancyError, getTenantContext } from '../src/index';

// Phase 0 isolation contract: the tenancy stub is NOT_IMPLEMENTED, which
// means no code path can resolve a TenantContext and therefore no
// cross-tenant data access is possible by construction.
// Phase 1B (blocks 019-021) replaces these stubs with real DB-backed
// isolation; at that point this file must grow tests that demonstrate
// tenant A cannot read tenant B's rows.

const tenantA = 'tenant-a' as TenantId;
const tenantB = 'tenant-b' as TenantId;
const userA = 'user-a' as UserId;
const userB = 'user-b' as UserId;

describe('tenant isolation — Phase 0 contract', () => {
  it('getTenantContext rejects for tenant A — no context leaks', async () => {
    await expect(getTenantContext(userA, tenantA)).rejects.toBeInstanceOf(TenancyError);
  });

  it('getTenantContext rejects for tenant B — no context leaks', async () => {
    await expect(getTenantContext(userB, tenantB)).rejects.toBeInstanceOf(TenancyError);
  });

  it('getTenantContext for user A with tenant B also rejects — no cross-tenant escalation', async () => {
    await expect(getTenantContext(userA, tenantB)).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
  });
});
