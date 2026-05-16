# `apps/api` — HTTP server shell

## Identity

The backend HTTP server for the SaaS workspace. Phase 0 lands a minimal
shell: a single `GET /health` endpoint and the Fastify lifecycle hooks
that later blocks plug into (auth middleware, tenant resolution, route
modules). Phase 1A Block 012 introduces the login endpoint and Block
013 plugs in the auth middleware; Phase 1B wires tenant resolution.

---

## What this owns

- The HTTP entry point (`src/index.ts`) — boots Fastify, registers
  routes, listens.
- The `GET /health` route — readiness probe for the PaaS HEALTHCHECK
  and any external monitor.
- The production Dockerfile.

## What this does NOT own

- Auth middleware — Phase 1A Block 013 (`packages/identity`).
- Tenant resolution middleware — Phase 1B (`packages/tenancy`).
- Domain logic — every endpoint delegates to the package that owns the
  bounded context. The API is a thin HTTP layer, never a place for
  business rules.
- Logging primitives — `@saas/observability` is the single source
  (per C3).

Per D1, this app never reaches into other packages' internals.

---

## Public surface

This is an application, not a library — there is no `index.ts` export
intended for cross-package use. The user-visible surface is the route
tree wired in `src/index.ts`:

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/health` | Returns `{ ok: true, version, uptime }`. Public; no auth. |

The `buildServer()` factory is exported from `src/index.ts` so the
in-process test (`__tests__/health.test.ts`) can boot the app via
`app.inject` rather than binding a real socket.

---

## Internal structure

```
apps/api/
├── src/
│   └── index.ts                ← Fastify shell + /health + entry point
├── __tests__/
│   └── health.test.ts          ← in-process /health smoke test
├── package.json
├── tsconfig.json               ← extends tsconfig.base.json
├── Dockerfile                  ← multi-stage; ADR-0004 portable
└── README.md                   ← this file
```

---

## Dependencies

External (pinned, per TS13):

- `fastify` 5.8.5 — HTTP framework (see [ADR-0003](../../decisions/ADR-0003-http-framework.md)).
- `tsx` 4.22.0 (dev) — TS runner for `pnpm dev` and the container
  runtime. See note below.
- `vitest` 4.1.6 (dev) — test runner.
- `typescript` 5.9.3 (dev) — matches workspace root.
- `@types/node` 22.19.19 (dev) — matches Node 22 LTS pinned in
  `.nvmrc`.

Workspace:

- `@saas/observability` (`workspace:*`) — structured logger.

No deep imports from observability (D1). No other `@saas/*` deps yet;
Phase 1+ adds `@saas/contracts`, `@saas/identity`, `@saas/tenancy`.

---

## How to run

Local dev:

```
pnpm install
pnpm --filter @saas/api dev
# server listens on http://localhost:3000
curl http://localhost:3000/health
```

Typecheck / lint / test:

```
pnpm --filter @saas/api typecheck
pnpm --filter @saas/api lint
pnpm --filter @saas/api test
```

Container (from repo root):

```
docker build -f apps/api/Dockerfile -t saas-api .
docker run --rm -p 3000:3000 saas-api
curl http://localhost:3000/health
```

Environment variables:

- `PORT` — defaults to `3000`.
- `HOST` — defaults to `0.0.0.0`.
- `APP_VERSION` — surfaced in `/health` payload. Defaults to `'dev'`.

---

## Runtime note — `tsx` instead of `node dist/index.js`

`@saas/observability` ships its public surface as TypeScript source
(`main: ./src/index.ts`) — a Block 003 convention. Plain Node 22
cannot import a `.ts` file without a loader, so the container's CMD is
`tsx src/index.ts` rather than `node dist/index.js`. The trade-off is
a small startup overhead (TS compilation on import) in exchange for not
adding a backend bundler in Phase 0. A future block introducing
`esbuild` or `tsup` can swap the entrypoint to `node dist/index.js`
once the bundled artifact inlines workspace deps; see
[ADR-0003](../../decisions/ADR-0003-http-framework.md) for the
reconsideration trigger.

---

## Cross-cutting concerns

- **Tenancy:** `/health` is public — no tenant context required. Every
  future endpoint will follow `T-4` (resolve `UserContext`, then
  `getTenantContext(userId, tenantId)`) before reaching domain code.
- **Observability:** `@saas/observability.createLogger('apps/api')` is
  the single logger; Fastify's built-in logger is disabled. Phase 1+
  adds per-route metrics (`http_requests_total`,
  `http_request_duration_seconds`) and trace spans via the framework
  lifecycle hooks.
- **Errors:** Phase 1+ wires a global `setErrorHandler` to map domain
  errors to the API4 envelope (Style A — plain object + status code).

---

## Current state

See [`STATE.md`](../../STATE.md) at the workspace root for cross-domain
state. No local `STATE.md` until active work resumes.

---

## How to add to this app

1. Read [`PROTOCOLS.md`](../../PROTOCOLS.md),
   [`protocols/TYPESCRIPT.md`](../../protocols/TYPESCRIPT.md),
   [`protocols/API.md`](../../protocols/API.md),
   [`protocols/TENANT.md`](../../protocols/TENANT.md).
2. Read [`decisions/ADR-0003-http-framework.md`](../../decisions/ADR-0003-http-framework.md)
   for framework conventions and
   [`decisions/ADR-0004-deploy.md`](../../decisions/ADR-0004-deploy.md)
   if touching the Dockerfile.
3. Author a block manifest from
   [`templates/manifest-M.md`](../../templates/manifest-M.md).
4. Implement within manifest scope (C2).
5. Validate: `typecheck`, `lint`, `test`, `dev`, container.
6. Open PR; tag for Governor review.
