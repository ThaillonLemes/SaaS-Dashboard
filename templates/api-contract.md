# API Contract Template

_Copy when defining a new HTTP endpoint or cross-domain contract._
_Lives next to the implementation, OR in `packages/contracts/src/<domain>/api.ts` for shared types._

---

# Contract: <Endpoint or operation name>

## Endpoint (if HTTP)

```
<METHOD> /<path-with-tenantId>
```

## Auth

- **Authentication:** Bearer token required | Public | Admin
- **Authorization:** <required role(s) or "tenant membership" or "n/a">

## Request

**Headers:**
- `Authorization: Bearer <token>` (required unless public)
- `Idempotency-Key: <uuid>` (required for mutations)

**Path parameters:**

| Name | Type | Description |
|------|------|-------------|
| `tenantId` | `TenantId` | Tenant scope |

**Query parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `cursor` | `string` | no | Pagination cursor |
| `limit` | `number` | no | Default 20, max 100 |

**Body:**

```ts
// In packages/contracts/src/<domain>/api.ts
export interface CreateDashboardRequest {
  name: string;          // 1-120 chars
  layout: DashboardLayout;
}
```

## Response

**Success (200 / 201):**

```ts
export interface CreateDashboardResponse {
  id: DashboardId;
  name: string;
  createdAt: string;     // ISO-8601
}
```

**Errors:**

| Status | Code | When |
|--------|------|------|
| 400 | `INVALID_REQUEST` | Body fails validation |
| 401 | `UNAUTHENTICATED` | Missing or invalid token |
| 403 | `TENANT_FORBIDDEN` | User not a member of `tenantId` |
| 404 | `TENANT_NOT_FOUND` | Tenant doesn't exist |
| 409 | `DASHBOARD_NAME_TAKEN` | Name conflict |
| 422 | `TENANT_PLAN_LIMIT_EXCEEDED` | Plan limit hit |
| 429 | `RATE_LIMITED` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

Error body shape:

```ts
{
  error: {
    code: string;
    message: string;
    details?: object;
    requestId: string;
  }
}
```

## Side effects

- Inserts row in `dashboards` table (tenant-scoped).
- Emits `dashboard.created` event (if event bus exists).
- Audit log entry (per audit policy).

## Idempotency

POST endpoints accept `Idempotency-Key`. Server stores key + response for 24h.
Repeated request with same key returns the original response (no duplicate side effect).

## Rate limit

Bucket: `dashboard:write` per tenant.
Default: 60 requests / minute per tenant. Configurable per plan.

## Observability

- Trace span: `dashboard.create`
- Metrics:
  - `http_requests_total{method=POST, route=/tenants/.../dashboards, status}`
  - `http_request_duration_seconds`
  - `dashboard_create_total{tenantId}`
- Log fields: `tenantId`, `userId`, `requestId`, `dashboardId` (after creation).

## Validation schema (server-side)

```ts
import { z } from 'zod';

export const CreateDashboardSchema = z.object({
  name: z.string().min(1).max(120),
  layout: DashboardLayoutSchema,
});

// Mirror with: type CreateDashboardRequest = z.infer<typeof CreateDashboardSchema>;
// or use zod-to-ts to keep contracts/ in sync.
```

## Frontend consumption

```ts
// apps/web/src/api/dashboard.ts
import { CreateDashboardRequest, CreateDashboardResponse } from '@saas/contracts';

export async function createDashboard(
  tenantId: TenantId,
  body: CreateDashboardRequest,
): Promise<CreateDashboardResponse> {
  return apiClient.post(`/tenants/${tenantId}/dashboards`, body);
}
```

## Versioning

This endpoint is part of the unversioned baseline. Future breaking changes
require a `/v2/...` path; this path stays available with a Sunset header.

---

## Reviewer checklist

- [ ] Request shape and response shape both in `packages/contracts/`.
- [ ] Validation schema at the boundary (zod or equivalent).
- [ ] Auth gate matches policy.
- [ ] Tenant context passed to service layer.
- [ ] Rate limit declared.
- [ ] Idempotency for mutations.
- [ ] Observability emitted.
- [ ] Errors catalogued in error code list.
- [ ] OpenAPI auto-generated.
