# Domain Architecture

The bounded contexts that compose this SaaS. Each is a separately ownable
package; each declares a public contract; each can be implemented in parallel
by a dedicated agent.

---

## Architecture style

**Domain-Driven Design with bounded contexts as packages.**

Every domain:
- Has a single, clear purpose.
- Exposes a typed public surface via `packages/<name>/index.ts`.
- Publishes its cross-domain types in `packages/contracts/src/<name>/`.
- Owns its own database tables (no cross-domain table mutations).
- Communicates with other domains ONLY through the published contract.
- Can be developed in parallel with other domains (per D1, D2 axioms).

---

## The domains

The list below is the **initial proposal**. Domains can be added, split, or
merged via Governor proposals.

### `contracts/` — the shared wire

**Purpose:** types, interfaces, and error unions that cross domain boundaries.
NOT a domain in the DDD sense — it's the wire format between domains.

**Owns:**
- TS types exported from `packages/contracts/src/<domain>/`
- Cross-domain error union types
- Branded primitive types (`TenantId`, `UserId`, etc.)

**Does NOT own:**
- Any implementation logic.
- Any I/O.
- Validation runtimes (those live in the producer or consumer).

**Public surface:** every type is a named export. No default exports.

**Owned by:** Contracts Agent (a single agent role; see `AGENT_OPERATING_MODEL.md`).

---

### `identity/` — authentication and user records

**Purpose:** authenticate users, manage sessions, expose user identity.

**Owns:**
- User records (id, email, hashed credentials, MFA state, audit log).
- Session tokens (issue, verify, revoke).
- Password reset flow.
- MFA / passkey flow.
- Login audit trail.

**Does NOT own:**
- Tenant membership (that's `tenancy/`).
- Roles and permissions (that's `tenancy/` — roles are tenant-scoped).
- Email delivery (that's `notifications/`).
- User-facing UI (that's `apps/web/`).

**Public surface:**
- `authenticate(credentials): Promise<Session>`
- `validateSession(token): Promise<UserContext>`
- `revokeSession(sessionId): Promise<void>`
- Types in `contracts/identity/` — `User`, `Session`, `UserContext`, `AuthError`.

**Parallel-safe with:** every other domain except `contracts/` and
`infrastructure/db` (shared concerns).

---

### `tenancy/` — tenant lifecycle, membership, plans, roles

**Purpose:** manage tenants (organizations), tenant membership, roles, and
plan limits.

**Owns:**
- Tenant records (id, name, plan, created_at, status).
- Tenant membership (user → tenant + role).
- Role definitions (per tenant, with hierarchy).
- Plan limits and enforcement gates.
- Tenant lifecycle events (created, suspended, deleted).

**Does NOT own:**
- User identity (that's `identity/`).
- Billing (that's `billing/`).
- Tenant-specific data (that's the respective domain — e.g., dashboards live in `dashboard/`).

**Public surface:**
- `getTenantContext(userId, tenantId): Promise<TenantContext>` — the canonical TenantContext factory.
- `enforceRole(ctx, requiredRole): void` — throws if the user lacks the role in the tenant.
- `enforcePlanLimit(ctx, resource): void` — throws if the tenant exceeds the resource limit.
- Types in `contracts/tenancy/` — `Tenant`, `TenantContext`, `Role`, `Plan`, `PlanLimit`.

**Critical contracts:** `TenantContext` is the single source of truth for "who is acting on which tenant in this request." Per T1, every domain operation accepts it.

**Parallel-safe with:** everything except `identity/` (which provides UserContext) and `contracts/`.

---

### `integrations/` — ERP API connectors

**Purpose:** connect to external ERP systems, fetch their data, deliver
raw payloads to `normalization/`.

**Owns:**
- Per-ERP connector implementations (one folder per ERP type).
- Connection lifecycle (auth, refresh tokens, rate limits).
- Pull schedules and incremental sync.
- Raw payload storage (before normalization).

**Does NOT own:**
- The canonical domain model (that's `normalization/`).
- Webhooks from ERPs (those route through `apps/api/` to here).
- ERP-specific business logic (only data shape).

**Public surface:**
- `connectErp(tenantId, erpType, credentials): Promise<Connection>`
- `pullData(connectionId, since): Promise<RawPayload[]>`
- Per-ERP feature flags via `getCapabilities(erpType): ErpCapabilities`.

**Parallel-safe with:** everything. Each ERP connector inside `integrations/`
is itself independently developable.

---

### `normalization/` — canonical domain model

**Purpose:** transform raw ERP payloads into the internal canonical model
that analytics, dashboards, and everything downstream consume.

**Owns:**
- Canonical domain entities (Customer, Order, Product, Invoice, etc. — proposed; actual list is a Phase 1 design block).
- Mapping rules per ERP type (`mapErpXxxToCanonical`).
- Validation and deduplication logic.
- Canonical entity persistence.

**Does NOT own:**
- Raw ERP payloads (that's `integrations/`).
- KPI computations (that's `analytics/`).
- ERP connector implementation.

**Public surface:**
- `normalize(rawPayload, mappingProfile): Promise<CanonicalEntity[]>`
- `queryCanonical<T>(tenant, entityType, filter): Promise<T[]>`
- Types in `contracts/normalization/` — the canonical entity union, `CanonicalQuery`, etc.

**Critical:** the canonical model is the long-term durable contract. Changes
to it are L-tier blocks (gate / cross-domain).

**Parallel-safe with:** most domains, but tightly coupled to `integrations/`
output shape.

---

### `analytics/` — KPI engine

**Purpose:** compute KPIs and aggregations over canonical data.

**Owns:**
- KPI definitions (name, formula, dimensions).
- Aggregation engine (group-by, time bucketing, rolling windows).
- KPI result caching (per tenant + filter signature).
- KPI access policies (which roles see which KPIs).

**Does NOT own:**
- The canonical model (that's `normalization/`).
- Dashboard layout (that's `dashboard/`).
- Visualization (that's `ui-kit/` + `apps/web/`).

**Public surface:**
- `computeKpi(ctx, kpiId, filters): Promise<KpiResult>`
- `listAvailableKpis(ctx): Promise<KpiDefinition[]>`
- Types in `contracts/analytics/`.

**Performance-critical:** yes. Per P4, every block here brackets benchmarks.

**Parallel-safe with:** everything except `normalization/` (consumes from).

---

### `dashboard/` — dashboard runtime

**Purpose:** dashboard definitions, layout persistence, dashboard-as-data.

**Owns:**
- Dashboard records (id, name, tenant, owner, layout JSON).
- Widget definitions (which KPI, which filters, which visualization).
- Dashboard sharing rules.
- Dashboard lifecycle (create, update, delete, duplicate).

**Does NOT own:**
- KPI computation (that's `analytics/`).
- Rendering (that's `ui-kit/` + `apps/web/`).
- Filter logic (that's a small package or part of analytics, TBD).

**Public surface:**
- `createDashboard(ctx, definition): Promise<Dashboard>`
- `getDashboard(ctx, dashboardId): Promise<Dashboard>`
- `updateDashboard(ctx, dashboardId, patch): Promise<Dashboard>`
- Types in `contracts/dashboard/`.

**Parallel-safe with:** everything except `analytics/` and `tenancy/`.

---

### `ui-kit/` — design system

**Purpose:** reusable React components and design tokens for the frontend.

**Owns:**
- Component library (Button, Input, Card, Table, Modal, etc.).
- Design tokens (colors, spacing, typography).
- Theme provider.
- Visualization primitives (Chart wrappers, KPI display).

**Does NOT own:**
- Page layouts (those are in `apps/web/`).
- Domain logic (no business rules here).
- Routing (in `apps/web/`).

**Public surface:** the full component library via `index.ts`. CSS extracted
at build time.

**Parallel-safe with:** all backend domains; tightly coupled to `apps/web/`.

---

### `observability/` — logging, metrics, tracing

**Purpose:** structured observability primitives used by all other packages.

**Owns:**
- Logger factory (per-package logger with tenant + request context).
- Metrics registry (counters, histograms, gauges).
- Trace span helpers.
- Standard log fields.

**Does NOT own:**
- Log destinations (decided per environment in `apps/api/`).
- Alerting (a future operations concern).

**Public surface:**
- `createLogger(packageName)`
- `metrics.counter(name, labels)`, etc.
- `withSpan(name, fn)`

**Parallel-safe with:** everything. This is a leaf dependency.

---

### Future domains (not yet active)

- **`billing/`** — subscription management, invoicing, payment provider integration.
- **`notifications/`** — email + in-app notifications, templates, delivery.
- **`audit/`** — security/compliance audit log.
- **`plugin/`** — extension point system (for white-label / enterprise).
- **`gateway/`** — public API gateway and rate limiting (may be `apps/api` middleware initially).
- **`search/`** — full-text / faceted search if needed.
- **`exports/`** — report exports (CSV, PDF).

Each is added via a Phase block.

---

## Cross-domain rules (the parallel-implementation enablers)

1. **D1 — no deep imports across packages.** Enforced by ESLint.
2. **D2 — contract before consumer.** A new cross-domain interface lands in `packages/contracts/` first; the consumer block depends on the contract, not the producer's impl.
3. **No circular package dependencies.** Detected by turborepo.
4. **Database tables are owned by exactly one package.** Cross-domain reads happen through the owning package's repository methods, not by direct DB queries from another package.
5. **`contracts/` has no runtime dependencies.** Pure types only. (Validators that use these types live in the owning domain.)

---

## Dependency graph (proposed)

```
                ┌──────────────────┐
                │   observability  │  (leaf — depends on nothing)
                └──────────────────┘
                          ▲
                          │ used by everyone
                          │
   ┌──────────────────────┴──────────────────────┐
   │                                             │
┌──┴────────────┐                            ┌───┴──────────┐
│   contracts   │  ← types-only,             │  identity    │
│   (types)     │     no deps                │              │
└───────┬───────┘                            └───────┬──────┘
        │                                            │
        │                                    used by everyone
        │
        ├──── tenancy   (depends on identity, contracts)
        │
        ├──── integrations (depends on tenancy, contracts)
        │
        ├──── normalization (depends on integrations, contracts)
        │
        ├──── analytics    (depends on normalization, contracts)
        │
        ├──── dashboard    (depends on analytics, tenancy, contracts)
        │
        └──── ui-kit       (no domain deps; consumed by apps/web)


apps/api  → all domains (orchestrator)
apps/web  → ui-kit + apps/api (HTTP) + types from contracts
```

The graph is intentionally a DAG — no cycles. This is what enables parallel
implementation.

---

## How to add a new domain

1. Submit Governor proposal: name, purpose, public surface, owned tables, dependencies.
2. Governor reviews against this doc — does the new domain overlap an existing one?
3. If approved: a Phase block creates `packages/<name>/` scaffold with `index.ts`, `README.md`, `STATE.md`, `package.json`, `tsconfig.json`, `src/`.
4. Update this doc, `STATE.md`, and the dependency graph.
