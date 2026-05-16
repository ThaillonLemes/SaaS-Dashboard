---
id: block-007-api-shell
tier: M
kind: implementation
phase: Phase 0 — Foundation
scope: phase-bound
status: Pending
domain: apps/api
risk: medium
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
  - block-003-observability
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/API.md
    - protocols/TENANT.md
    - decisions/ADR-0001-monorepo.md
    - decisions/ADR-0004-deploy.md
    - templates/adr-template.md
  modify: []
  create:
    - decisions/ADR-0003-http-framework.md
    - apps/api/package.json
    - apps/api/tsconfig.json
    - apps/api/README.md
    - apps/api/src/index.ts
    - apps/api/Dockerfile
    - apps/api/__tests__/health.test.ts
benchmarks: []
flags: []
metrics:
  - http_requests_total
  - http_request_duration_seconds
contracts_consumed: []
---

# Block 007 — `apps/api` shell with `/health`

## 1. Purpose

Land the HTTP server shell. Picks the HTTP framework via ADR-0003
(Fastify default; Hono acceptable; Express discouraged). Wires
`@saas/observability` for logging + tracing. Exposes a single endpoint:
`GET /health` returning `{ ok: true, version, uptime }`. Ships a
portable Dockerfile per ADR-0004.

## 2. Dependencies

- Block 001 (workspace + tsconfig + ESLint).
- Block 003 (observability — logger + metrics + spans wired into the
  framework's request lifecycle).

## 3. ADR-0003 (authored in this block)

Pick **Fastify** vs Hono vs Express. Default: Fastify. Document
trade-offs:
- Fastify: performant, plugin ecosystem, zod integration via
  `fastify-type-provider-zod`, OpenAPI via `fastify-swagger`.
- Hono: faster, more portable (edge runtimes), smaller bundle. Less
  plugin maturity.
- Express: most popular, weakest types, slow. Discouraged unless a
  hard dep forces it.

The agent picks and writes the ADR.

## 4. Public surface (`apps/api/src/index.ts`)

```ts
// Fastify example (replace with Hono/Express equivalent if ADR-0003 chooses different)
import Fastify from 'fastify';
import { createLogger } from '@saas/observability';

const log = createLogger('apps/api');

const app = Fastify({
  logger: false,  // we use @saas/observability instead
  trustProxy: true,
});

const STARTED_AT = Date.now();

app.get('/health', async (_req, reply) => {
  return reply.send({
    ok: true,
    version: process.env.APP_VERSION ?? 'dev',
    uptime: Math.floor((Date.now() - STARTED_AT) / 1000),
  });
});

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

app.listen({ port: PORT, host: HOST })
  .then(addr => log.info('api.started', { addr, port: PORT }))
  .catch(err => { log.error('api.start.failed', { err: err.message }); process.exit(1); });
```

## 5. Dockerfile

Per ADR-0004 portability constraint:
- Multi-stage build: `node:22-alpine` builder + runtime.
- Builds via `pnpm install --frozen-lockfile --prod=false`, then
  `pnpm --filter @saas/api build`.
- Runtime stage copies only `dist/` + `node_modules/` + `package.json`.
- Exposes `PORT` env var (default 3000).
- `CMD ["node", "dist/index.js"]`.
- HEALTHCHECK calls `/health`.
- No PaaS-specific instructions; runs on any container platform.

## 6. README

Per `templates/domain-doc.md`. Identity (HTTP server), public surface
(`/health` for now; auth + tenants + dashboards in Phase 1+),
dependencies (`@saas/observability`; future: `@saas/identity`,
`@saas/tenancy`, etc.), how to run locally (`pnpm dev --filter @saas/api`),
how to build (`pnpm build --filter @saas/api`).

## 7. Tests (`__tests__/health.test.ts`)

- Boot the server in-process; `GET /health` returns 200 with
  `{ ok: true, version, uptime }`.
- Uptime is a non-negative integer.
- Version reads from `APP_VERSION` env or falls back to `'dev'`.

## 8. Validation

- `pnpm --filter @saas/api typecheck` passes.
- `pnpm --filter @saas/api lint` passes.
- `pnpm --filter @saas/api test` passes (the `/health` test).
- `pnpm --filter @saas/api dev` boots successfully on a free port.
- `docker build -f apps/api/Dockerfile .` succeeds in CI.
- `docker run --rm -p 3000:3000 <image>` starts and `/health` responds 200.
- Logs are structured JSON (one line per log; `tenantId`/`userId` absent
  is OK — there's no auth yet).

## 9. Rollback signals

- HTTP framework can't load `@saas/observability` (ESM/CJS interop).
- Dockerfile build fails or runtime container can't start.
- `/health` returns non-JSON or wrong status.

## 10. Expected outcomes

After integration:
- `apps/api` boots locally and in containers.
- Phase 1A Block 012 (login endpoint) extends this shell with auth
  routes.
- The Backend App Agent (per
  [AGENT_OPERATING_MODEL.md:294-319](../../AGENT_OPERATING_MODEL.md:294))
  is the sole writer to `apps/api/` going forward.

## 11. Tenant safety check

- [x] N/A — `/health` is public, no tenant context.
- [x] BUT: the framework's request-lifecycle hooks are wired so
      Phase 1A Block 013 can plug in auth + `getTenantContext`
      middleware without restructuring.

## 12. Cross-domain check

- [x] No deep imports across packages (D1) — only `@saas/observability`
      public surface.
- [x] Cross-domain types live in `packages/contracts/` (D2) — not used
      yet; Phase 1A introduces.
- [x] No utility duplication (C3) — single HTTP server for the workspace.

## 13. Risks

- **Risk:** Fastify v5+ has known ESM caveats on Node 22. **Mitigation:** Use the official `fastify` v5 with ESM; if breakage, the agent documents the workaround in the ADR.
- **Risk:** Dockerfile portability constraint (ADR-0004) prevents using Fly's `fly.toml`-specific tricks. **Mitigation:** Block 009 wires the platform-specific deploy YAML separately; the Dockerfile itself stays generic.
- **Risk:** `@saas/observability` SDK initialization slows boot. **Mitigation:** Lazy-init the OTel exporter; logger is sync.

## 14. Out of scope

- Auth middleware (Phase 1A Block 013).
- Tenant resolution middleware (Phase 1B).
- Login endpoint (Phase 1A Block 012).
- Other CRUD endpoints (Phase 1+ per package).
- Rate limiting (Phase 1+ Block — per T2).
- OpenAPI schema generation (Phase 1A when first real endpoint lands).

## 15. New abstraction

None. Framework + logger + Dockerfile — all off-the-shelf.
