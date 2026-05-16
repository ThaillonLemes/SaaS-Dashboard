---
id: block-003-observability
tier: M
kind: implementation
phase: Phase 0 — Foundation
scope: phase-bound
status: Pending
domain: packages/observability
risk: low
performance_critical: false
created_at: 2026-05-15
estimated_duration_days: 1
dependencies:
  - block-001-monorepo-skeleton
parallel_with: []
files:
  read:
    - PROTOCOLS.md
    - protocols/TYPESCRIPT.md
    - protocols/TENANT.md
    - DOMAIN_ARCHITECTURE.md
    - templates/domain-doc.md
  modify: []
  create:
    - packages/observability/package.json
    - packages/observability/tsconfig.json
    - packages/observability/README.md
    - packages/observability/src/index.ts
    - packages/observability/src/logger.ts
    - packages/observability/src/metrics.ts
    - packages/observability/src/spans.ts
    - packages/observability/__tests__/logger.test.ts
benchmarks: []
flags: []
metrics: []
contracts_published: []
---

# Block 003 — `packages/observability` (logger / metrics / spans)

## 1. Purpose

Land the leaf-dependency package that every other package consumes. Ships:
- `createLogger(packageName)` → structured JSON logger.
- `metrics` registry (counters, histograms, gauges).
- `withSpan(name, attrs, fn)` → trace-span helper.

These are the standard primitives consumed by every domain package and
both apps per [DOMAIN_ARCHITECTURE.md:236-253](../../DOMAIN_ARCHITECTURE.md:236).

## 2. Dependencies

- Block 001 (workspace must be ready to host a new package).

## 3. Scope

### Public surface (`packages/observability/src/index.ts`)

```ts
export { createLogger } from './logger';
export type { Logger, LogFields } from './logger';
export { metrics } from './metrics';
export type { Counter, Histogram, Gauge } from './metrics';
export { withSpan, getCurrentSpan } from './spans';
export type { Span, SpanAttrs } from './spans';
```

### Logger (`src/logger.ts`)

- `createLogger(packageName)` returns a `Logger` with `info / warn / error / debug` methods.
- Every log line carries: `packageName`, `level`, `timestamp` (ISO),
  `message`, plus any user-supplied fields.
- When `TenantContext` is available (passed in fields), emits `tenantId`
  + `userId` per [protocols/TENANT.md:130-149](../../protocols/TENANT.md:130).
- PII rules: never log full email; truncate / hash; document in
  package README.
- Implementation: thin wrapper around `pino` (or `console.log` JSON if
  the agent prefers no dep — pino strongly recommended).

### Metrics (`src/metrics.ts`)

- `metrics.counter(name, labels?)` → `Counter` with `inc(amount?)`.
- `metrics.histogram(name, labels?)` → `Histogram` with `observe(value)`.
- `metrics.gauge(name, labels?)` → `Gauge` with `set(value)`.
- Registry is in-process for Phase 0; export to OTLP wired in Phase 3+.
- Per ADR-0004 portability: emit via OpenTelemetry SDK so the exporter
  is swappable per environment.

### Spans (`src/spans.ts`)

- `withSpan(name, attrs, fn)` opens a span, runs `fn`, records duration,
  closes span. Async-safe.
- `getCurrentSpan()` returns the active span (for adding events / attrs).
- OTel-backed; no-op exporter by default; production exporter wired in
  Block 009 / Phase 3+.

### `package.json`

- `"name": "@saas/observability"`.
- `"private": true`.
- `"main": "./src/index.ts"`, `"types": "./src/index.ts"` (or compiled
  `./dist/index.js` if build step is added).
- Dependencies: `pino`, `@opentelemetry/api`, `@opentelemetry/sdk-node`,
  `@opentelemetry/sdk-trace-base`.
- DevDependency: `vitest`, `typescript`.

### Tests (`__tests__/logger.test.ts`)

- Smoke test: `createLogger('test').info('hello', { foo: 'bar' })` emits
  a JSON line with `packageName: 'test'`, `level: 'info'`, `foo: 'bar'`.
- Tenant-aware test: log with `tenantId` in fields → output contains it.
- PII test: log with `email: 'foo@bar.com'` in fields → output truncates
  or hashes; raw email not present.

### README

Per [templates/domain-doc.md](../../templates/domain-doc.md). Public
surface, consumers, PII rules, OTel exporter wiring (Phase 3+).

## 4. Validation

- `pnpm install` picks up the new package.
- `pnpm --filter @saas/observability typecheck` passes.
- `pnpm --filter @saas/observability lint` passes.
- `pnpm --filter @saas/observability test` passes (all 3 smoke tests).
- ESLint's D1 rule does NOT flag any deep import (observability is a
  leaf — no domain deps).

## 5. Rollback signals

- pino or OTel SDK breaks TS strict mode types.
- Logger emits non-JSON (breaks log aggregation contract).

## 6. Expected outcomes

After integration:
- Every later package imports from `@saas/observability` for logging /
  metrics / spans.
- `apps/api` (Block 007) wires the production exporter.
- Phase 1+ packages have no excuse for `console.log`.

## 7. Tenant safety check

- [x] N/A for the package's own data (it has no tables).
- [x] BUT the logger's API supports `tenantId` field — documented in
      README so consumers always pass it.

## 8. Cross-domain check

- [x] No deep imports across packages (D1) — observability has no
      package deps.
- [x] Cross-domain types live in `packages/contracts/` (D2) — none
      needed; `Logger` / `Counter` / `Span` are observability-internal
      types but exported so consumers can type-annotate.
- [x] No utility duplication (C3) — this IS the workspace's
      logger/metrics/span utility. No parallel one allowed.

## 9. Risks

- **Risk:** OTel SDK has high cold-start cost. **Mitigation:** Lazy-init the SDK; logger works without OTel running.
- **Risk:** Pino's transport (file vs stdout) interacts oddly with PaaS log capture. **Mitigation:** Default to stdout; explicit transport only in dev.

## 10. Out of scope

- Production log destination wiring (Block 007 / Block 009).
- Alerting (Phase 3+).
- Per-tenant log routing (Phase 4+ if needed).
- Metric backends (Prometheus exporter / Datadog / etc.) — wired in
  Block 009 + ops.

## 11. New abstraction

`createLogger` / `metrics` / `withSpan` are the only public surface.
These are not abstractions over hypothetical needs — they're concrete
utilities. Q1 satisfied.
