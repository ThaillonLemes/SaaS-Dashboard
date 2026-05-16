# ADR-0003: HTTP framework — Fastify

- **Status:** Accepted
- **Date:** 2026-05-16
- **Deciders:** Backend App Agent (Block 007) + Workspace Governor
- **Tags:** infrastructure, backend, apps/api

## Context

Block 007 introduces `apps/api` — the workspace's HTTP server. It will
grow through Phase 1+ to host auth, tenant resolution, dashboards,
analytics, ERP integrations, and billing endpoints. Phase 0 only needs
`GET /health`, but the framework choice here cascades to every handler,
every plugin, every middleware ordering decision for years.

Five constraints frame the choice:

1. **Types-first.** Per `protocols/TYPESCRIPT.md` (TS1/TS2), strict
   mode and `zod`-style boundary validation (per `protocols/API.md`
   API3) are non-negotiable. Handler types must flow from a schema
   without `as` assertions.
2. **Plugin ecosystem.** Phase 1+ will need rate limiting (T2),
   OpenAPI generation (API12), CORS + security headers (API14), JWT
   auth (API6), request-id correlation, idempotency-key storage (API9).
   Building these from scratch is wasted Phase 1 budget.
3. **Performance headroom.** The API hosts dashboard reads and KPI
   aggregations (Phase 2). Per-request overhead under 1 ms is desirable;
   the framework should not be the bottleneck.
4. **Portability.** Per ADR-0004 the runtime is `node:22-alpine` in any
   container platform. No edge-runtime lock-in.
5. **Observability integration.** Logging must route through
   `@saas/observability` (no parallel logger — C3). The framework's
   built-in logger must be disable-able without losing request lifecycle
   hooks.

The manifest defaults to Fastify, marks Hono as acceptable, and
discourages Express. This ADR records the actual choice and the
trade-offs that survive the decision.

## Decision

**Fastify v5.x on Node 22, ESM.**

Concretely:

| Concern | Choice |
|---------|--------|
| Framework | `fastify` v5.x (pinned exact per TS13) |
| Module system | ESM (matches workspace; `"type": "module"`) |
| Built-in logger | **Disabled** (`logger: false`); `@saas/observability` `createLogger('apps/api')` carries all log lines |
| Validation | `zod` schemas at the handler boundary (Phase 1+; not used in `/health`) |
| Schema-to-types | `fastify-type-provider-zod` (Phase 1+ when the first real endpoint lands) |
| OpenAPI | `@fastify/swagger` + `@fastify/swagger-ui` (Phase 1+ alongside the first contract endpoint) |
| Rate limiting | `@fastify/rate-limit` keyed by tenant ID (Phase 1+ per T2) |
| CORS | `@fastify/cors` (Phase 1+ when `apps/web` calls real endpoints) |
| Trust proxy | `trustProxy: true` (sets `x-forwarded-for` resolution for PaaS edge) |

Phase 0 (this block) only depends on `fastify` itself plus
`@saas/observability`. Plugins land in the blocks that need them — no
speculative installs (per Q1, rule of three for abstraction; equivalent
restraint applies to plugin breadth).

## Alternatives considered

### Alternative A: Hono

- **Pros:** Smaller (≈20 KB), faster on cold-start, first-class types,
  runs on Bun / Deno / Cloudflare Workers / Vercel Edge — best
  portability across runtime targets.
- **Cons:** Plugin ecosystem is markedly thinner than Fastify's for
  Node-targeted patterns (rate limiting backed by Redis, OpenAPI
  generation with shared schemas, idempotency-key storage). Most Hono
  middleware is edge-runtime-shaped and assumes streaming responses;
  some Node-friendly equivalents exist but are younger. Less ambient
  documentation / Stack Overflow surface for the patterns we'll need in
  Phase 1+.
- **Rejected because:** ADR-0004 locks deploy to a Node container on a
  Fly-class PaaS — Hono's portability advantage is unused, and we'd pay
  for it via more bespoke middleware. The decision can be revisited if
  an edge-runtime target enters the roadmap.

### Alternative B: Express (5.x)

- **Pros:** Most ambient familiarity; largest community.
- **Cons:** Types are an afterthought; middleware signatures fall back
  to `any` without manual annotation, violating TS2. Performance is
  ~3× slower per request than Fastify on the workloads we care about
  (JSON in, JSON out). Plugin model uses callbacks; async error
  propagation is a known footgun. Per the manifest, Express is
  discouraged.
- **Rejected because:** Familiarity is not a load-bearing constraint
  for AI implementation, and the type-system gap is a daily tax.

### Alternative C: NestJS

- **Pros:** Opinionated module structure; DI container; large enterprise
  community.
- **Cons:** Heavy framework footprint; decorators / metadata reflection
  are at odds with Q1 (simplicity) and Q4 (locality of reasoning — the
  control flow is hidden behind decorators). Cold-start ~5× Fastify.
- **Rejected because:** The workspace already has its own discipline
  layer (PROTOCOLS.md + domain isolation + contracts) — NestJS's
  opinions would compete rather than compose.

### Alternative D: Native `node:http` + hand-written routing

- **Pros:** Zero dependencies; absolute minimum surface area.
- **Cons:** We'd reimplement schema validation hooks, plugin lifecycle,
  reply serialization, error mapping, and request lifecycle observability
  — every one of these is solved by Fastify's `addHook` + `onRequest`
  + `onError`.
- **Rejected because:** New-abstraction tax (C3) without a corresponding
  benefit. The framework's job is to be off-the-shelf.

## Consequences

### Positive

- **Schema-typed handlers.** Once `fastify-type-provider-zod` is wired
  in Phase 1+, request bodies, params, and replies are fully inferred
  from `zod` schemas — no `as` casts, no manual `req.body as Foo`.
- **First-class hooks.** `onRequest`, `preHandler`, `onResponse`,
  `onError` give us a clean place to plug auth (Block 013), tenant
  resolution (Phase 1B), rate limiting (per T2), and per-request
  observability (API13) without restructuring.
- **Disabling the built-in logger** is one line (`logger: false`) — we
  route everything through `@saas/observability`, preserving C3 (no
  parallel utility).
- **JSON serialization is `fast-json-stringify`-based** when a reply
  schema is declared — measurable latency win on hot endpoints in
  Phase 2.
- **Multi-instance plugin model** matches our future per-tenant rate
  limit / idempotency-key scopes.

### Negative

- **ESM-only on Node 22** has a known caveat: some Fastify v5 plugins
  still ship CJS-default. We pin only `fastify` itself in Phase 0; if a
  plugin in Phase 1+ surfaces an interop issue we document the
  workaround in a follow-up ADR or block retrospective. Mitigation: the
  shell in Block 007 imports only `fastify` — interop risk is deferred
  to the block that pulls in the first plugin.
- **Vendor lock to Node-runtime semantics.** If a future block requires
  edge-runtime deploy (Cloudflare Workers, Vercel Edge), Fastify
  doesn't run there — we'd need a port. Trigger documented under
  "Reconsideration trigger" below.
- **Plugin install discipline.** Every new plugin is its own
  `pnpm add --filter @saas/api ...` in the block that needs it — no
  bundled "starter plugin pack." This is a feature, not a bug, but it
  means agents must remember the install step.

### Neutral / informational

- Fastify v5 enforces `request.body` typing per schema; we'll need
  `zod` validation on every mutation handler (Phase 1+). The pattern is
  documented in API3 and is non-negotiable regardless of framework.
- The default content-type parser handles JSON; we'll add specific
  parsers (multipart, octet-stream) only when a feature needs them.

## Validation

How we'll know this was correct:

- **Block 007 ships green:** `GET /health` returns 200 in-process
  (vitest) and in container (`docker run`).
- **Phase 1A integration:** Block 013 (auth middleware) plugs into
  Fastify's `onRequest` hook without restructuring the shell. If the
  hook lifecycle forces a workaround, the ADR is partially wrong.
- **Per-request overhead:** once the first real endpoint lands, p50
  latency for a no-op handler stays under 1 ms on the standard CI
  worker. (Bench landing in Phase 1.)
- **Reconsideration trigger:** an edge-runtime deploy target enters the
  roadmap; or a Fastify plugin gap forces > 2 hand-rolled middleware in
  the same package; or per-request overhead crosses 5 ms p50 without
  business-logic explanation.

## Implementation impact

- **New blocks required:** Block 007 (this block — installs `fastify`,
  authors `src/index.ts` + Dockerfile + health test).
- **New blocks anticipated:** Block 013 (auth middleware — pulls in
  `@fastify/jwt` or equivalent), Phase 1+ first contract endpoint
  (pulls in `fastify-type-provider-zod` + `@fastify/swagger`),
  rate-limit block (`@fastify/rate-limit` + Redis).
- **Migrations required:** none.
- **Estimated effort:** S (the ADR + the shell already fits Block 007's
  Tier-M scope).

## References

- [ADR-0001](./ADR-0001-monorepo.md) — pnpm + TS + ESLint stack the
  shell extends.
- [ADR-0004](./ADR-0004-deploy.md) — portability constraints the
  Dockerfile honors.
- [protocols/API.md](../protocols/API.md) — HTTP conventions every
  handler implements.
- [protocols/TYPESCRIPT.md](../protocols/TYPESCRIPT.md) — TS2 (no `any`)
  + TS4 (errors as values) rules the framework integration respects.
- [manifests/active/block-007-api-shell.md](../manifests/active/block-007-api-shell.md) — the block that lands this ADR.
- [Fastify docs](https://fastify.dev/docs/latest/) — chosen framework
  documentation (not binding).
