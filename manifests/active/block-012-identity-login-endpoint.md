---
id: block-012-identity-login-endpoint
tier: M
kind: implementation
phase: Phase 1A — Identity
scope: phase-bound
status: Complete
domain: apps/api
risk: high
performance_critical: false
created_at: 2026-05-19
estimated_duration_days: 1
dependencies:
  - block-007-api-shell
  - block-011-identity-password-auth
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/API.md
    - protocols/TENANT.md
    - apps/api/src/index.ts
    - packages/identity/src/index.ts
    - packages/contracts/src/identity/index.ts
    - decisions/ADR-0003-http-framework.md
  modify:
    - apps/api/src/index.ts
  create:
    - apps/api/src/routes/auth.ts
    - apps/api/__tests__/auth.test.ts
benchmarks: []
flags: []
metrics:
  - auth_login_total
  - auth_login_duration_seconds
contracts_consumed:
  - packages/contracts/src/identity/index.ts
---

# Block 012 — Login API endpoint

## 1. Purpose

Add `POST /login` to `apps/api`, wiring `loginUser` from `@saas/identity`
into the Fastify route. Returns a session token on success.

## 2. Dependencies

- Block 007 — Fastify shell (`buildServer` export).
- Block 011 — `loginUser`, `IdentityError`, `SessionToken`.

## 3. Scope

### `apps/api/src/routes/auth.ts`

```ts
import type { FastifyInstance } from 'fastify';
import { loginUser } from '@saas/identity';
import { IdentityError } from '@saas/contracts';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'tenantId'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
          tenantId: { type: 'string', minLength: 1 },
        },
      },
    },
  }, async (req, reply) => {
    const { email, password, tenantId } = req.body as {
      email: string; password: string; tenantId: string;
    };
    try {
      const token = await loginUser(email, password, tenantId as TenantId, req.db);
      return reply.send({ token });
    } catch (err) {
      if (err instanceof IdentityError && err.code === 'INVALID_CREDENTIALS') {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }
      throw err;
    }
  });
}
```

### Wire into `apps/api/src/index.ts`

Register `authRoutes` plugin in `buildServer()`.
Add `db` decorator to Fastify instance (Drizzle client from `DATABASE_URL` env).

### `apps/api/__tests__/auth.test.ts`

- `POST /login` with valid credentials returns 200 + `{ token: string }`.
- `POST /login` with wrong password returns 401.
- `POST /login` with missing fields returns 400.

## 4. Validation

- `pnpm --filter @saas/api typecheck` passes.
- `pnpm --filter @saas/api lint` passes.
- `pnpm --filter @saas/api test` passes.

## 5. Tenant safety

- [x] `tenantId` required in body — no cross-tenant login possible.
- [x] 401 message is generic — no user enumeration.

## 6. Out of scope

- Session middleware (Block 013).
- Refresh tokens.
- OAuth.
