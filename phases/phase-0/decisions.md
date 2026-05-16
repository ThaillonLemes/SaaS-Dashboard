# Phase 0 — Decisions

_Architectural calls made during Phase 0. Append as decisions land. Full
ADRs live in `./decisions/ADR-NNNN-*.md`; this file is the index + the
short-form rationale._

---

## D-0.1 — Project scope: `@saas/`

**Decided:** 2026-05-15 (pre-Phase-0, Governor bootstrap question batch).

The pnpm scope is `@saas/`. All workspace packages use this prefix:
`@saas/contracts`, `@saas/identity`, `@saas/tenancy`, etc. Project name
in `orchestrator.config.yaml` stays `saas`.

Recorded in: `.governor/proposals/2026-05-15-scope-rename.md`.

---

## D-0.2 — Monorepo + tool stack

**Decided:** ADR-0001 (Governor pre-Block-001).

- **Package manager:** pnpm (workspaces, fast, deterministic).
- **Build orchestration:** turborepo.
- **Language:** TypeScript with project references; root `tsconfig.base.json` enforces strict mode + extras (see ADR-0001).
- **Lint:** ESLint at root with `@typescript-eslint/strict-type-checked`; `import/order` enforced; `no-restricted-imports` blocks deep imports across packages (per D1).
- **Format:** Prettier.
- **Test runner:** Vitest (unit + integration); Playwright (e2e in apps/web).
- **Node version:** pinned via `.nvmrc` (LTS — Node 22).

See [ADR-0001](../../decisions/ADR-0001-monorepo.md) for alternatives and trade-offs.

---

## D-0.3 — Postgres + ORM choice

**Status:** Deferred to Block 002.

Block 002's agent authors ADR-0002 after evaluating Drizzle vs Kysely vs Prisma
against the project's needs (type-safety, migration ergonomics, RLS friendliness).
Recommendation in the cognition layer ([protocols/DATABASE.md:88](../../protocols/DATABASE.md:88))
is **Drizzle**, but the agent makes the call.

Constraint regardless of choice: must support raw SQL escape hatch and Postgres
RLS `current_setting('app.tenant_id')` pattern.

---

## D-0.4 — Deploy: PaaS-first, portable

**Decided:** ADR-0004 (Governor pre-Block-001).

Initial production deploy: **Fly.io** (or equivalent PaaS — Railway, Render
acceptable). Design for portability so a future move to AWS or GCP is a config
change, not a rewrite.

Hard constraints (enforced from Block 001):
- 12-factor app: config via env vars, no platform-specific filesystem assumptions.
- Standard Dockerfile that runs on any container platform.
- Managed Postgres only — no PaaS-specific data persistence features (Fly Volumes, Render Disks).
- Secrets via environment variables, never committed.
- Static assets served from CDN-friendly path; no PaaS-specific edge functions.

See [ADR-0004](../../decisions/ADR-0004-deploy.md) for the migration trigger and
rejected alternatives.

---

## D-0.5 — HTTP framework choice

**Status:** Deferred to Block 007.

Block 007's agent authors ADR-0003. Cognition layer's lean is **Fastify**
(performance + type safety + plugin ecosystem). Hono is acceptable; Express is
discouraged unless plugin availability forces it.

Constraint: must support zod-based request validation, OpenAPI generation
from schemas, and pluggable middleware (auth, rate limit, observability).

---

## D-0.6 — Billing model

**Decided:** ADR-0005 (Governor pre-Block-001).

**Tier-based with usage caps.** Three tiers — `starter`, `pro`, `enterprise`.
Each tier carries a `PlanLimit` shape with hard caps on:

- Rows ingested from ERPs (per month).
- Number of dashboards.
- Number of distinct KPIs.
- Number of ERP connections.
- Number of seats (members of the tenant).

Tenancy enforces caps before write (per T2 — Tenant Fairness). Phase 3 wires
Stripe; tier transitions go through `packages/billing`. No metered overage in
v1 — caps are hard.

See [ADR-0005](../../decisions/ADR-0005-billing.md) for tier shape and
alternatives rejected.

---

## D-0.7 — First ERP: CISSPoder

**Status:** Decision recorded, implementation deferred to Phase 1C Block 027.

User has a CISSPoder client lined up. The connector framework (Block 025) stays
generic, but the first concrete connector (Block 027 in Phase 1C) targets
CISSPoder's REST API. This constrains the canonical model's vocabulary
(Phase 1D Block 031) toward Brazilian retail/wholesale: Cliente, Produto,
Venda, NFe, NFC-e, CFOP, Operação.

Recorded here for context; the operational ADR-0006 lands at Phase 1C kickoff.

---

## D-0.8 — Manifest format alignment

**Status:** Open issue; defer to post-Phase-0 Governor proposal.

The orchestrator parser expects YAML frontmatter delimited by `---`; the
manifest schemas (`orchestrator/schemas/manifest-{S,M,L}.schema.yaml`) validate
the YAML; but the manifest templates (`templates/manifest-{S,M,L}.md`) use a
markdown-bullet format. Phase 0 manifests follow the schema (YAML frontmatter)
because that's what `governor preflight` validates against.

Follow-up: a Governor proposal to update the templates to match the schema.
Not blocking Phase 0.
