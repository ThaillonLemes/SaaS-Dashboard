import { expectTypeOf } from 'vitest';

import type { Email, UserId } from '../src/identity/types';
import type { Plan, PlanLimit, PlanTier } from '../src/tenancy/plan';
import type { AdminContext, Role, TenantContext, TenantId } from '../src/tenancy/types';

type Writable<T> = { -readonly [K in keyof T]: T[K] };

// Branded primitives must NOT inter-assign — domain isolation depends on it.
expectTypeOf<TenantId>().not.toMatchTypeOf<UserId>();
expectTypeOf<UserId>().not.toMatchTypeOf<TenantId>();
expectTypeOf<Email>().not.toMatchTypeOf<UserId>();
expectTypeOf<UserId>().not.toMatchTypeOf<Email>();
expectTypeOf<Email>().not.toMatchTypeOf<TenantId>();
expectTypeOf<TenantId>().not.toMatchTypeOf<Email>();

// Branded primitives are still strings at runtime, but not assignable FROM string.
expectTypeOf<UserId>().toMatchTypeOf<string>();
expectTypeOf<TenantId>().toMatchTypeOf<string>();
expectTypeOf<Email>().toMatchTypeOf<string>();
expectTypeOf<string>().not.toMatchTypeOf<UserId>();
expectTypeOf<string>().not.toMatchTypeOf<TenantId>();
expectTypeOf<string>().not.toMatchTypeOf<Email>();

// PlanTier is exactly the ADR-0005 trio — adding a tier requires an ADR.
expectTypeOf<PlanTier>().toEqualTypeOf<'starter' | 'pro' | 'enterprise'>();

// Role is exactly the four foundation roles — Phase 1B may extend additively.
expectTypeOf<Role>().toEqualTypeOf<'owner' | 'admin' | 'member' | 'viewer'>();

// TenantContext.plan.tier carries the PlanTier contract end-to-end.
declare const ctx: TenantContext;
expectTypeOf(ctx.plan.tier).toEqualTypeOf<PlanTier>();
expectTypeOf(ctx.roles).toEqualTypeOf<ReadonlyArray<Role>>();
expectTypeOf(ctx.tenantId).toEqualTypeOf<TenantId>();
expectTypeOf(ctx.userId).toEqualTypeOf<UserId>();

// Readonly is part of the contract — stripping readonly yields a different type.
expectTypeOf<Plan>().not.toEqualTypeOf<Writable<Plan>>();
expectTypeOf<PlanLimit>().not.toEqualTypeOf<Writable<PlanLimit>>();
expectTypeOf<TenantContext>().not.toEqualTypeOf<Writable<TenantContext>>();
expectTypeOf<AdminContext>().not.toEqualTypeOf<Writable<AdminContext>>();

// Plan.validUntil intentionally accepts null (current paid plan per ADR-0005);
// rejects undefined under exactOptionalPropertyTypes.
declare const plan: Plan;
expectTypeOf(plan.validUntil).toEqualTypeOf<string | null>();
