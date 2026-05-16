# `packages/observability` — structured logger, metrics, spans

## Identity

The leaf-dependency package that every other workspace package consumes for
structured logging, in-process metrics, and trace-span helpers. Owns the
**single** way the workspace emits telemetry: one logger factory, one metrics
registry, one span helper. No parallel utility (C3).

---

## What this owns

- `createLogger(packageName)` — newline-delimited JSON logger with PII
  redaction.
- `metrics` — OTel-backed registry exposing `counter`, `histogram`, `gauge`.
- `withSpan(name, attrs, fn)` / `getCurrentSpan()` — trace-span helpers.
- The standard set of log fields every record carries (`packageName`,
  `level`, `time`, `message`).

## What this does NOT own

- Log destinations — the producer of records writes to `stdout`; the host
  process (PaaS, container runtime) captures it. Production wiring lands in
  `apps/api` (Block 007) / `apps/web` (Block 008) and the CI/CD block
  (Block 009).
- Alerting — out of scope for Phase 0.
- Metric exporters (Prometheus, OTLP) — wired in Block 009 + ops.

Per D1, this package never reaches into other packages' internals — and has
no `@saas/*` deps itself.

---

## Public surface (`src/index.ts`)

```ts
export { createLogger } from './logger';
export type { Logger, LogFields } from './logger';

export { metrics } from './metrics';
export type { Counter, Histogram, Gauge } from './metrics';

export { withSpan, getCurrentSpan } from './spans';
export type { Span, SpanAttrs } from './spans';
```

There are no cross-domain types in `packages/contracts/` — `Logger`,
`Counter`, `Span`, etc. are observability-internal types exported so
consumers can type-annotate their bindings.

---

## Internal structure

```
packages/observability/
├── src/
│   ├── index.ts        ← public surface
│   ├── logger.ts       ← createLogger + PII redaction
│   ├── metrics.ts      ← OTel-backed counter/histogram/gauge
│   └── spans.ts        ← withSpan / getCurrentSpan
├── __tests__/
│   └── logger.test.ts  ← 3 smoke tests
├── package.json
├── tsconfig.json
└── README.md           ← this file
```

---

## Dependencies

- `pino` — JSON log emitter.
- `@opentelemetry/api` — meter / tracer accessors (no-op when no SDK
  registered).
- `@opentelemetry/sdk-node`, `@opentelemetry/sdk-trace-base` — bundled so
  consumer apps can wire an exporter without re-adding deps.

No `@saas/*` deps (leaf — D1 satisfied trivially).

---

## PII rules

Per [protocols/TENANT.md:147-149](../../protocols/TENANT.md:147), production
logs must not carry raw PII.

- `tenantId`, `userId` — emitted verbatim (already opaque IDs).
- `email` — SHA-256 hashed (12-hex prefix) before serialization. Raw values
  never appear in output.
- Other PII fields (names, phones, addresses) — should be omitted by the
  caller. Field-level redaction beyond `email` is a future block when the
  full PII taxonomy is authored (security guide, Phase 3+).

The redaction is performed in `redactPii` inside `src/logger.ts` and applies
recursively to nested objects.

---

## Tenant safety

The package has no tables and no I/O of its own — T1 is N/A for state.

The logger's `LogFields` type carries optional `tenantId` and `userId`
fields; consumers are encouraged (but not enforced) to pass them on every
log line per the tenant addendum.

---

## Cross-cutting concerns

- **Tenancy:** every emitted log line accepts (and is encouraged to carry)
  `tenantId` / `userId`.
- **Observability of itself:** none. This IS the workspace's observability
  primitive (C3 — no parallel utility).
- **Errors:** `withSpan` records exceptions on the span before rethrowing —
  the caller still observes the throw.

---

## OTel exporter wiring

The package depends on `@opentelemetry/api` for instrument/tracer accessors
and on the OTel SDKs for downstream consumers. With no SDK registered, the
API returns no-op tracers and meters — calls are cheap and side-effect-free.

Production wiring (block 009 + ops) will:

1. Initialize a `NodeSDK` with the desired exporters.
2. Call `sdk.start()` at process boot, before any `getMeter` /
   `getTracer` calls land in hot paths.

Until then, this package is safe to call from any context.

---

## Testing

```
pnpm --filter @saas/observability test
```

The smoke tests in `__tests__/logger.test.ts` cover:

- JSON output shape (`packageName`, `level`, `message`, user fields).
- Tenant-context propagation (`tenantId` / `userId` present when passed).
- PII redaction (raw `email` never appears in output).

Logger tests inject a custom `destination` stream via the optional second
argument to `createLogger` — production consumers do not need to.

---

## How to add to this domain

1. Read this file + `./PROTOCOLS.md` + `./protocols/TYPESCRIPT.md`.
2. Read `./protocols/TENANT.md` for tenant-field conventions.
3. Author a block manifest from `./templates/manifest-M.md`.
4. Implement within manifest scope (C2).
5. Validate per manifest.
6. Open PR; tag for Governor review.
