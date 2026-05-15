# API Addendum

_Extends `./PROTOCOLS.md` with HTTP / REST conventions. Loaded for any endpoint work in `apps/api`._

---

## API1 — REST is the default

Default HTTP style for `apps/api`:
- Resource-oriented URLs (`/dashboards/:id`, not `/getDashboard?id=...`).
- Standard HTTP methods (GET, POST, PATCH, DELETE).
- JSON request and response bodies.
- Standard HTTP status codes (200, 201, 204, 400, 401, 403, 404, 409, 422, 500).

GraphQL is **not** the default. Adding it later requires Governor proposal.

---

## API2 — URL structure

```
GET    /tenants/:tenantId/dashboards
POST   /tenants/:tenantId/dashboards
GET    /tenants/:tenantId/dashboards/:dashboardId
PATCH  /tenants/:tenantId/dashboards/:dashboardId
DELETE /tenants/:tenantId/dashboards/:dashboardId
```

The tenant ID is in the path for clarity and observability. The auth
middleware verifies the user is a member of that tenant (per T1).

Internal endpoints (admin / system):
```
GET /admin/tenants                  ← AdminContext required
POST /system/migrations             ← AdminContext required
```

These have a different auth gate; documented in `apps/api/README.md`.

---

## API3 — Request validation at the boundary

Per Q2, validate at boundaries. Every request body, query string, and path
param goes through a `zod` schema (or equivalent) before reaching the handler:

```ts
import { z } from 'zod';

const CreateDashboardSchema = z.object({
  name: z.string().min(1).max(120),
  layout: DashboardLayoutSchema,
});

// In handler:
const body = CreateDashboardSchema.parse(req.body);
// body is now typed and validated.
```

Schemas live next to the handler. Cross-cutting types live in `contracts/`.

---

## API4 — Response envelope

All responses follow a consistent envelope. Pick ONE style (the choice is
fixed at Phase 0):

**Style A — Plain object on success, error object on failure:**

```ts
// Success:
{ id: "uuid", name: "Dashboard 1", ... }

// Error:
{ error: { code: "DASHBOARD_NOT_FOUND", message: "...", details: { ... } } }
```

**Style B — Wrapped envelope:**

```ts
// Success:
{ data: { id: "uuid", name: "..." } }

// Error:
{ error: { code: "DASHBOARD_NOT_FOUND", message: "..." } }
```

Choose one. **Recommended: Style A.** Less ceremony for the common case;
status code carries success/failure signal.

---

## API5 — Error model

Error codes are stable, machine-readable identifiers. Errors carry:

```ts
{
  error: {
    code: string;             // e.g. "TENANT_PLAN_LIMIT_EXCEEDED"
    message: string;          // human-readable, may be localized later
    details?: object;         // structured details (which limit, current value, etc.)
    requestId: string;        // for support traceability
  }
}
```

Error codes are in SCREAMING_SNAKE_CASE. They're versioned via the API; once
released, codes are not renamed.

Codes are catalogued in `packages/contracts/src/errors.ts` (or per-domain).
This is the canonical list.

---

## API6 — Authentication

- **Bearer tokens** in the `Authorization` header.
- **Session tokens** issued by `packages/identity` on login; signed and time-limited.
- **Refresh tokens** (if used) with rotation.
- **API keys** for service-to-service or programmatic access (Phase 3+ feature).

Tokens never carry tenant claims directly. The user's tenant memberships are
resolved per-request from the database. This keeps token revocation
effective.

---

## API7 — Authorization

- Auth middleware resolves `UserContext` from the bearer token.
- Route handlers call `getTenantContext(userId, tenantIdFromPath)` from `packages/tenancy`.
- `enforceRole(ctx, 'admin')` or similar gates restricted endpoints.
- Permission errors are 403 (forbidden); auth errors are 401 (unauthenticated).

---

## API8 — Rate limiting

Per T2 — tenant fairness:

- Per-tenant rate limits on all write endpoints.
- Per-tenant rate limits on expensive read endpoints (KPI computations, exports).
- 429 response with `Retry-After` header when exceeded.
- Limit tiers tied to tenant plan (`Plan` from `packages/tenancy`).

Implementation: Redis-backed token bucket via `packages/observability` or a
dedicated rate-limit utility.

---

## API9 — Idempotency

- All mutation endpoints (POST, PUT, PATCH, DELETE) accept an `Idempotency-Key` header.
- Server stores the key + response for 24h.
- Repeat with same key returns the original response (no duplicate side effects).
- Implementation: Redis-backed with TTL.

This is critical for ERP webhooks and client retries.

---

## API10 — Pagination

Two styles, chosen per endpoint:

**Cursor-based** (preferred for large unbounded sets):

```
GET /dashboards?limit=20&cursor=eyJpZCI6Li4ufQ
→ { items: [...], nextCursor: "eyJpZCI6Li4ufQ" | null }
```

**Offset-based** (OK for bounded UIs with known total):

```
GET /tenants?limit=20&offset=40
→ { items: [...], total: 113 }
```

Choose per endpoint based on usage. Document in the API contract.

---

## API11 — Versioning

URL-based versioning when needed:
```
/v1/dashboards
/v2/dashboards
```

Default: no version in URL until a breaking change is shipped. Then `/v2/...`
introduced; `/v1/...` deprecated with a sunset header (`Sunset: <date>`).

Most contract changes are additive (new fields) and don't need versioning.

---

## API12 — Documentation

OpenAPI / Swagger schema generated from `zod` schemas. Lives at:
- `/openapi.json` (machine-readable)
- `/docs` (interactive UI in dev; gated in prod)

Generated, not hand-written. Hand-written API docs are forbidden — they drift.

---

## API13 — Observability per endpoint

Every endpoint emits:
- A trace span with method + path + tenant ID + status.
- A metric counter: `http_requests_total{method, route, status}`.
- A metric histogram: `http_request_duration_seconds{method, route}`.
- Structured log with request ID, user ID, tenant ID, status, duration.

Standard via `packages/observability`.

---

## API14 — CORS, CSRF, security headers

- CORS allow-list configured per environment (dev permissive; prod strict).
- CSRF for cookie-based auth (we use bearer tokens, so this is moot for API; relevant for any cookie sessions in admin UI).
- Security headers via middleware: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, etc.

---

## API15 — Contracts in `packages/contracts/`

The shape of API request/response bodies lives in `packages/contracts/`:

```ts
// packages/contracts/src/dashboard/api.ts
export interface CreateDashboardRequest { ... }
export interface CreateDashboardResponse { ... }
export interface DashboardListResponse { ... }
```

Both the backend (apps/api) and the frontend (apps/web) import these types.
Single source of truth — no shape drift between client and server.

Validation schemas (`zod`) live in `apps/api` (server-side enforcement) and
mirror the types from `contracts/`. Schema generation tools (`zod-to-ts`,
etc.) can keep them aligned.
