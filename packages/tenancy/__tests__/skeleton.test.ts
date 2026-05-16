import type { Role, TenantContext, TenantId } from '@saas/contracts';
import type { UserId } from '@saas/contracts';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  TenancyError,
  enforcePlanLimit,
  enforceRole,
  getTenantContext,
  type ResourceKind,
} from '../src/index';
import type { TenantContext as ReexportedTenantContext } from '../src/index';

const fakeUserId = 'user-skeleton' as UserId;
const fakeTenantId = 'tenant-skeleton' as TenantId;

const fakeCtx: TenantContext = {
  tenantId: fakeTenantId,
  userId: fakeUserId,
  roles: ['owner'] as ReadonlyArray<Role>,
  plan: {
    tier: 'starter',
    limits: {
      rowsPerMonth: 100_000,
      maxDashboards: 3,
      maxKpis: 10,
      maxErpConnections: 1,
      maxSeats: 3,
    },
    validUntil: null,
  },
};

describe('getTenantContext', () => {
  it('throws TenancyError with code NOT_IMPLEMENTED (Phase 1B block-019 fills in)', async () => {
    await expect(getTenantContext(fakeUserId, fakeTenantId)).rejects.toBeInstanceOf(
      TenancyError,
    );
    await expect(getTenantContext(fakeUserId, fakeTenantId)).rejects.toMatchObject({
      code: 'NOT_IMPLEMENTED',
    });
  });
});

describe('enforceRole', () => {
  it('throws TenancyError with code NOT_IMPLEMENTED (Phase 1B block-020 fills in)', () => {
    expect(() => {
      enforceRole(fakeCtx, 'admin');
    }).toThrow(TenancyError);
    try {
      enforceRole(fakeCtx, 'admin');
    } catch (err) {
      expect(err).toBeInstanceOf(TenancyError);
      expect((err as TenancyError).code).toBe('NOT_IMPLEMENTED');
    }
  });
});

describe('enforcePlanLimit', () => {
  it('throws TenancyError with code NOT_IMPLEMENTED (Phase 1B block-021 fills in)', () => {
    expect(() => {
      enforcePlanLimit(fakeCtx, 'maxDashboards', 0);
    }).toThrow(TenancyError);
    try {
      enforcePlanLimit(fakeCtx, 'maxDashboards', 0);
    } catch (err) {
      expect(err).toBeInstanceOf(TenancyError);
      expect((err as TenancyError).code).toBe('NOT_IMPLEMENTED');
    }
  });
});

describe('public surface contracts', () => {
  it('re-exports TenantContext identical to @saas/contracts TenantContext', () => {
    expectTypeOf<ReexportedTenantContext>().toEqualTypeOf<TenantContext>();
  });

  it('ResourceKind names each PlanLimit field exactly once', () => {
    expectTypeOf<ResourceKind>().toEqualTypeOf<
      | 'rowsPerMonth'
      | 'maxDashboards'
      | 'maxKpis'
      | 'maxErpConnections'
      | 'maxSeats'
    >();
  });
});
