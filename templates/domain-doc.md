# Domain Documentation Template

_Copy to `packages/<domain>/README.md` when bootstrapping a new domain package._

---

# `packages/<domain>` — <One-line purpose>

## Identity

One paragraph: what this domain owns and why it exists.

---

## What this owns

- <Concept 1>
- <Concept 2>
- <Database tables: `<table_name>`>
- <Other owned state>

## What this does NOT own

- <Adjacent concern> — lives in `packages/<other>`
- <Adjacent concern> — lives in `packages/<other>`

Per D1, this package never reaches into other packages' internals.

---

## Public surface (`src/index.ts`)

Functions / types exported:

```ts
// Example
export function getTenantContext(userId: UserId, tenantId: TenantId): Promise<TenantContext>;
export function enforceRole(ctx: TenantContext, requiredRole: Role): void;
```

Types in `packages/contracts/src/<domain>/`:
- `TenantContext`
- `Role`
- `Plan`

---

## Internal structure

```
packages/<domain>/
├── src/
│   ├── index.ts                 ← public surface
│   ├── internal/                ← not exported
│   │   ├── ...
│   ├── repository.ts            ← DB access
│   ├── service.ts               ← business logic
│   └── types.ts                 ← internal types
├── __tests__/
├── package.json
├── tsconfig.json
└── README.md                    ← this file
```

---

## Dependencies

- `@app/contracts` — types
- `@app/observability` — logging, metrics
- `@app/<other>` — <reason>

No deep imports from any of the above (D1).

---

## Database tables

- `<table_name>` — <one-line purpose>. Tenant-scoped: yes/no.

All tenant-scoped tables have `tenant_id NOT NULL` + RLS policy (per T1).

---

## Cross-cutting concerns

- **Tenancy:** every public method accepts `TenantContext` (or `AdminContext` for cross-tenant ops).
- **Observability:** every method emits a trace span + log line; durations are metrics.
- **Errors:** thrown errors are subclasses of `<DomainErrorBase>`; cross-domain returns use `Result<T, E>` from `@app/contracts`.

---

## Testing

- Unit tests in `__tests__/<file>.test.ts`.
- Integration tests use a real DB (via Testcontainers or similar): `__tests__/integration/`.
- Tenant isolation tests (per T9 in TENANT addendum): mandatory.

Run: `pnpm test --filter=@app/<domain>`

---

## Current state

See `STATE.md` (if present) for what's actively changing. Cross-domain state
in `./STATE.md`.

---

## How to add to this domain

1. Read this file + `./PROTOCOLS.md` + `./protocols/TYPESCRIPT.md`.
2. Read relevant protocol addenda (DATABASE if touching DB, TENANT for tenant work).
3. Author a block manifest from `./templates/manifest-M.md`.
4. Implement within manifest scope.
5. Validate per manifest.
6. Open PR; tag for Governor review.
