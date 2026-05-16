# `apps/api` — HTTP API server

## Identity

The API server is the single HTTP entry point for the SaaS Dashboard
backend. It hosts all tenant-scoped REST endpoints, wires authentication
and tenancy middleware, and emits structured logs and metrics via
`@saas/observability`. Phase 0 ships only the server shell and `/health`;
full business endpoints land in Phase 1+.

---

## What this owns

- HTTP server process (`Fastify v5`)
- `GET /health` — public liveness probe
- Request lifecycle hooks (auth, tenant context — Phase 1+)
- Route handlers for all API endpoints (Phase 1+)

## What this does NOT own

- Authentication logic — lives in `packages/identity`
- Tenant resolution — lives in `packages/tenancy`
- Structured logging and metrics — lives in `packages/observability`
- Database access — lives in domain packages (`packages/dashboards`, etc.)
- API type contracts — live in `packages/contracts`

Per D1, this package never reaches into other packages' internals.

---

## Public surface

```
GET /health
→ 200 { ok: true, version: string, uptime: number }
```

`version` reads from `APP_VERSION` env var (falls back to `"dev"`).
`uptime` is seconds since process start, as a non-negative integer.

Future endpoints (Phase 1+):
```
POST   /auth/login
GET    /tenants/:tenantId/dashboards
POST   /tenants/:tenantId/dashboards
...
```

---

## Dependencies

- `@saas/observability` — structured logger (`createLogger`)
- Future: `@saas/identity` — user authentication
- Future: `@saas/tenancy` — tenant context resolution
- Future: `@saas/contracts` — request/response type contracts

No deep imports from any of the above (D1).

---

## Running locally

```sh
pnpm dev --filter @saas/api
```

Server starts at `http://localhost:3000` by default. Override with:

```sh
PORT=4000 pnpm dev --filter @saas/api
```

---

## Building

```sh
pnpm build --filter @saas/api
```

Output: `apps/api/dist/index.js` (ESM). Run with:

```sh
node apps/api/dist/index.js
```

---

## Testing

```sh
pnpm test --filter @saas/api
```

Tests use Fastify's `inject` API — no port binding needed.

---

## Type-checking and linting

```sh
pnpm typecheck --filter @saas/api
pnpm lint --filter @saas/api
```

Both must exit 0 before commit (P3).

---

## Container build

```sh
docker build -f apps/api/Dockerfile -t saas-api .
docker run --rm -p 3000:3000 saas-api
```

The image runs on any container platform (Fly.io, ECS, Cloud Run,
Kubernetes) per ADR-0004.

---

## Environment variables

| Variable      | Default     | Purpose                             |
|---------------|-------------|-------------------------------------|
| `PORT`        | `3000`      | Listening port                      |
| `HOST`        | `0.0.0.0`   | Listening host                      |
| `APP_VERSION` | `dev`       | Reported in `/health` response      |

---

## Current state

Phase 0 — server shell only. See `manifests/active/block-007-api-shell.md`
for scope. Phase 1 blocks extend this shell with auth routes and
tenant-scoped endpoints.
