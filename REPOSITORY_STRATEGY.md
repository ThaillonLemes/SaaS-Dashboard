# Repository Strategy

The single biggest structural decision in a SaaS workspace is repo layout.
This doc captures the decision and its rationale. ADR-0001 in
`./decisions/` is the immutable record; this doc is the operational
reference.

---

## Decision: monorepo with workspace packages

**Tool stack:**
- **Package manager:** `pnpm` (workspaces native, faster than npm, deterministic).
- **Build orchestration:** `turborepo` (task graph, remote cache, incremental builds).
- **Type-checking:** TypeScript project references across packages.
- **Linting:** ESLint at workspace root, per-package config extends shared.
- **Testing:** Vitest at package level + Playwright at e2e level.

Alternatives evaluated: see "Alternatives considered" at the end.

---

## Why monorepo

For an AI-native SaaS with parallel implementation as the primary goal:

| Concern | Monorepo answer |
|---------|-----------------|
| Shared types between frontend/backend | One `packages/contracts/` package; all consumers import from it; type changes propagate instantly via TS project refs. |
| Atomic cross-domain changes | A single PR can touch multiple packages when needed (e.g., adding a new feature requires contract + producer + consumer). |
| CI/CD complexity | One pipeline; turborepo handles incremental builds and per-package deploys. |
| AI navigation | Single repo to clone; agents navigate by package name; no cross-repo state sync. |
| Bounded contexts | Enforced via package boundaries + ESLint no-deep-imports rule. |
| Independent deployability | Each `apps/*` deploys independently via turbo pipelines. Packages don't deploy — they're consumed. |
| Permission model | If needed, CODEOWNERS file routes per-package reviews. |
| Onboarding cost | Single `pnpm install`; new developers see the whole architecture in one place. |

---

## Layout

```
<project-root>/
├── pnpm-workspace.yaml         ← workspace definition
├── turbo.json                  ← turborepo pipeline config
├── package.json                ← root scripts
├── tsconfig.base.json          ← shared TS config
├── .eslintrc.cjs               ← shared ESLint config
├── ./                 ← the cognitive layer (this folder)
│
├── apps/                       ← deployable applications
│   ├── api/                    ← backend HTTP API (Express / Fastify / Hono — TBD)
│   │   ├── src/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── README.md
│   ├── web/                    ← React frontend
│   │   ├── src/
│   │   ├── package.json
│   │   └── README.md
│   └── jobs/                   ← background workers (if needed)
│       └── ...
│
├── packages/                   ← bounded contexts (libraries, no deployment)
│   ├── contracts/              ← shared TS types/interfaces — the cross-domain wire
│   │   ├── src/
│   │   │   ├── identity/       ← types owned by identity domain
│   │   │   ├── tenancy/        ← types owned by tenancy domain
│   │   │   └── ...
│   │   └── package.json
│   ├── identity/               ← auth, sessions, users
│   ├── tenancy/                ← tenants, plans, limits
│   ├── integrations/           ← ERP connectors
│   ├── normalization/          ← canonical domain model from ERP data
│   ├── analytics/              ← KPI engine, aggregations
│   ├── dashboard/              ← dashboard runtime, definitions
│   ├── ui-kit/                 ← design system primitives (React)
│   ├── observability/          ← logging, metrics, tracing
│   └── (more as domains emerge)
│
├── infrastructure/             ← anything not source code
│   ├── db/                     ← Postgres schema + migrations
│   │   ├── migrations/
│   │   ├── seeds/
│   │   └── schema.sql
│   ├── deploy/                 ← deployment configs (Docker, k8s, fly.io, etc.)
│   └── ci/                     ← GitHub Actions, etc.
│
└── README.md                   ← workspace identity
```

---

## Package rules

1. **Every `packages/<name>/` has a public surface.** `index.ts` exports the public API. Internal modules live in `src/internal/` and are not re-exported.

2. **No deep imports across packages.** Enforced by ESLint:
   ```
   '@app/identity'         ✅ public surface
   '@app/identity/src/...' ❌ deep import — forbidden
   ```

3. **Each package declares its dependencies** in its `package.json`. No implicit dependencies via root.

4. **No circular dependencies.** Turborepo detects and fails the build.

5. **`packages/contracts/` is the wire.** Cross-domain types live there. A domain package consumes contracts but doesn't expose contract types directly — it exposes implementations and methods.

6. **App-only code stays in `apps/`.** If logic lives in `apps/api/`, it's API-specific. Reusable logic moves to a package.

---

## Naming conventions

- **Package names:** `@app/<domain>` (e.g., `@app/identity`, `@app/contracts`).
- **App names:** `@app/<app-name>` (e.g., `@app/api`, `@app/web`).
- **Internal paths:** `packages/identity/src/...` (snake-case folders, PascalCase TS files for components / Pascal classes).
- **Test files:** `*.test.ts` colocated with code, or under `__tests__/`.

---

## Build pipeline (turborepo)

`turbo.json` declares the task graph:

```json
{
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["build"]
    },
    "lint": {},
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

`^build` means "build all of this package's dependencies first." Incremental
across the graph; cached across CI runs.

---

## Deployment

- **`apps/api/`** deploys as a Docker image. Build via `turbo run build --filter=@app/api`. Runtime: Node.js LTS.
- **`apps/web/`** deploys as a static SPA (or SSR if needed later). Build artifacts in `apps/web/dist/`.
- **`apps/jobs/`** (when introduced) deploys as a separate container running background workers.
- **Database migrations** run as a pre-deploy step, not embedded in app containers.

Each app has its own Dockerfile under `apps/<name>/`. Shared base images live
in `infrastructure/deploy/`.

---

## Alternatives considered

### Multi-repo

**Rejected.** Reasons:
- Cross-package type sharing requires npm publishing or git submodules (both add friction).
- AI coordination across repos requires either a workspace agent (this very system, but applied across repos with overhead) or duplicated state files (drift).
- CI/CD multiplies.
- For a single product (one SaaS), there's no permission / release-cadence reason to split.

Multi-repo wins when there are multiple products sharing some libraries
(e.g., a public client SDK shipped to external developers). Not our case.

### Single package (no workspace)

**Rejected.** Reasons:
- Domain isolation can't be enforced by package boundaries.
- `apps/web/` and `apps/api/` would share a single `src/` tree, making
  bundling rules harder.
- No incremental build benefit.

### Nx instead of turborepo

**Considered, deferred.** Nx is more powerful but adds opinionation we don't
yet need. Turborepo's simplicity wins for the early stage. Can migrate to Nx
later if the project grows beyond turbo's task graph capability.

### `npm` instead of `pnpm`

**Rejected.** Reasons:
- npm workspaces are slower and have flat node_modules issues.
- pnpm is the de facto choice for AI-friendly monorepos in 2026.

---

## When to revisit this decision

This decision is durable but not eternal. Revisit if:

- The project grows to 50+ packages (turborepo's task graph may strain).
- We split into multiple products (genuine reason to multi-repo).
- We need air-gapped enterprise on-premise builds (different concerns).

Until then, monorepo + pnpm + turborepo is the architecture.
