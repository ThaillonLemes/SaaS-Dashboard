# ADR-0003: HTTP framework — Fastify

- **Status:** Accepted
- **Date:** 2026-05-16
- **Deciders:** Backend App Agent (block-007-api-shell)
- **Tags:** backend, http, framework, api

## Context

Block 007 lands the `apps/api` shell. A concrete HTTP framework must be
chosen before any endpoint work can begin. Three candidates are in scope
for a Node.js 22 / TypeScript / ESM-native stack:

- **Fastify v5** — mature plugin ecosystem, first-class TypeScript types,
  `fastify-type-provider-zod` for schema-driven validation, and
  `fastify-swagger` for OpenAPI generation. ESM support shipped in v5.
- **Hono** — significantly faster raw throughput, edge-runtime portable,
  smaller bundle. Plugin ecosystem is newer and less complete. Zod
  integration and OpenAPI generation are available but less battle-tested
  at scale.
- **Express** — most popular Node.js framework, largest community. Weak
  TypeScript types, no built-in schema validation, slowest throughput of
  the three. Middleware ecosystem is mature but aging.

The workspace's API protocol (protocols/API.md) requires:
- Schema-validated requests at the boundary (API3, zod).
- OpenAPI schema generation (API12).
- Structured observability per endpoint (API13).
- Standard HTTP idioms (API1).

The deploy protocol (ADR-0004) requires a portable container; no
edge-only runtimes.

Throughput requirements for Phase 0 are modest (< 1,000 req/s single
instance), so raw performance is not the deciding factor yet.

## Decision

**Fastify v5** with `logger: false` (structured logging via
`@saas/observability`) and `trustProxy: true` (PaaS reverse-proxy
compatibility).

Fastify is selected because it satisfies every Phase 0 API-protocol
requirement out of the box and has the strongest TypeScript + zod
integration among the candidates. The performance advantage of Hono is
not a deciding factor at current scale, and Fastify's plugin ecosystem
reduces future implementation cost for auth, rate limiting, and OpenAPI.

## Alternatives considered

### Alternative A: Hono

- **Pros:** Highest raw throughput among the three. Edge-runtime portable
  (Cloudflare Workers, Deno Deploy). Smaller bundle size. Clean API.
- **Cons:** Plugin ecosystem is younger — `@hono/zod-openapi` is less
  mature than Fastify's `fastify-swagger`. Edge portability is not needed
  per ADR-0004 (containers on PaaS). Fewer production case studies at
  scale for complex multi-tenant SaaS.
- **Rejected because:** The edge-portability advantage is unused (ADR-0004
  targets standard containers), and the plugin maturity gap increases risk
  for Phase 1+ features (auth, rate limiting, OpenAPI).

### Alternative B: Express

- **Pros:** Largest community. Most StackOverflow answers. Everyone knows it.
- **Cons:** Weak TypeScript types (community `@types/express`; framework
  internals not type-safe). No built-in schema validation — `zod` must be
  wired manually. Significantly slower than Fastify. No first-party OpenAPI
  plugin.
- **Rejected because:** Weak types conflict with TS2 (no `any`) and TS1
  (strict mode). The performance gap is measurable even at modest traffic.
  The ecosystem age creates maintenance burden.

## Consequences

### Positive

- `fastify-type-provider-zod` provides a single-call schema validation +
  TypeScript inference path (API3) with no boilerplate.
- `@fastify/swagger` + `@fastify/swagger-ui` generate OpenAPI from route
  schemas (API12) — no hand-writing required.
- Fastify's request-lifecycle hooks (onRequest, preHandler, onSend) provide
  clean injection points for auth middleware, tenant resolution, and
  observability (API13) in Phase 1.
- `trustProxy: true` ensures `X-Forwarded-*` headers are trusted behind a
  PaaS reverse proxy.

### Negative

- Fastify v5 introduced breaking changes from v4; future plugins must be
  v5-compatible. The ecosystem has not yet fully caught up (as of 2026-05-16).
- Fastify's plugin encapsulation model (scoped contexts) requires learning.
  Simpler apps can use it incorrectly (registering plugins at the wrong
  scope). Documented in Block 012 when auth routes land.

### Neutral / informational

- `logger: false` is intentional. Fastify's built-in Pino logger is
  replaced by `@saas/observability` (which also uses Pino internally) to
  keep the log format consistent across all packages.
- If a future block demonstrates that Hono's throughput is needed (e.g.,
  an edge-deployed API function for latency-sensitive reads), a new ADR
  may introduce Hono for that specific surface without replacing Fastify
  as the main server.

## Validation

- `pnpm --filter @saas/api typecheck` exits 0 with Fastify types.
- `pnpm --filter @saas/api test` boots a Fastify server in-process and
  `GET /health` returns 200.
- Reconsideration trigger: if measured p99 latency on `/health` exceeds
  50 ms under 1,000 concurrent connections in Phase 1 load tests, or if a
  required Phase 2+ plugin is unavailable for Fastify v5.

## Implementation impact

- New blocks required: block-007 (this block — ships the framework).
- Migrations required: none.
- Estimated effort: S (framework selection + single endpoint).

## References

- Related ADRs: ADR-0001 (monorepo + TypeScript stack), ADR-0004 (deploy)
- protocols/API.md — API conventions this choice must satisfy
- [Fastify v5 docs](https://fastify.dev)
- [Hono docs](https://hono.dev)
- Block 007 manifest: `manifests/active/block-007-api-shell.md`
