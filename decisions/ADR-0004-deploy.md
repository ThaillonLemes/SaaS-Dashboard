# ADR-0004: Deploy — PaaS-first, portable

- **Status:** Accepted
- **Date:** 2026-05-15
- **Deciders:** Workspace Governor + user (bootstrap conversation, 2026-05-15)
- **Tags:** infrastructure, deploy, operations

## Context

Phase 0 needs to land Dockerfiles + a CI workflow that can deploy
`apps/api` and `apps/web`. The user wants the fastest path to production
now (a CISSPoder client is lined up — see Phase 0 decisions D-0.7), with
a clear escape hatch to scale later. Operating Kubernetes or building a
custom AWS stack for the first 10 customers would be over-engineering.

The choice has to satisfy two constraints simultaneously:

1. **Ship fast.** Production-ready in days, not weeks. Managed Postgres,
   managed deploys, managed TLS, managed log aggregation.
2. **Don't lock in.** When the business case justifies AWS or GCP
   (real enterprise customers, compliance requirements, scale beyond a
   single region), the move should be a config change, not a rewrite.

## Decision

**PaaS-first, portable.** Initial production target is **Fly.io** (or an
equivalent — Railway, Render). Every implementation choice in Phase 0
respects a portability constraint set so that migrating to AWS / GCP
later is a config + Terraform change, not a code rewrite.

### Portability constraints (binding from Block 001 forward)

- **12-factor app.** Config via environment variables. No platform
  filesystem assumptions. Stateless processes.
- **Standard Dockerfile.** Multi-stage build. Resulting image runs on
  any container platform (Fly Machines, ECS, Cloud Run, Kubernetes).
- **Managed Postgres only.** Use the PaaS's managed Postgres (Fly
  Postgres / Render Postgres / Railway Postgres). No platform-specific
  data persistence features. No Fly Volumes for stateful data. When the
  app moves to AWS, it points at RDS — no code change.
- **Secrets via env vars.** No platform-specific secret stores in
  production code. The deployment platform injects secrets at runtime
  (Fly Secrets / Render env vars). When the platform changes, the
  injection mechanism changes; the app reads `process.env` either way.
- **Static assets via CDN-friendly path.** `apps/web` builds to
  `apps/web/dist/`. Production serves these via the PaaS's edge or via
  a CDN behind the same domain. No PaaS-specific edge functions in core
  logic.
- **No PaaS-specific cron / queue / scheduler primitives in the
  application code.** Background jobs (Phase 1+) use a Postgres-backed
  queue (e.g., pg-boss) or a generic broker — never Fly Machines'
  scheduled-task API or Render's cron jobs as the only abstraction.
- **Observability via standard exporters.** Logs to stdout; metrics via
  OpenTelemetry to a generic OTLP endpoint. Not Fly's built-in metrics
  or Render's log drain as the only output.

### What this gives up

- Some PaaS-native conveniences: Fly Volumes (cheap persistent disk),
  Render Disks, platform-specific scheduled tasks. The portability
  constraint vetoes them.
- A bit of cost overhead: managed Postgres on PaaS is more expensive
  per-GB than RDS at scale. Acceptable until scale forces the move.

## Alternatives considered

### Alternative A: AWS-first (ECS + RDS + ALB)

- **Pros:** Most mature operations story. Best long-term cost at scale.
  Familiar to most engineers.
- **Cons:** Weeks to set up safely (IAM, VPC, secrets, ALB, certificate
  manager, CodePipeline, ...). Operationally heavy for the first 10
  customers. Distracts from product work.
- **Rejected because:** Time-to-market matters now. The CISSPoder client
  is real; ops overhead is not the right place to spend Phase 0 hours.

### Alternative B: Self-hosted Docker on a VPS

- **Pros:** Cheapest. Full control.
- **Cons:** You operate the box. TLS, backups, log rotation,
  Postgres tuning, OS patches, monitoring — all your problem. Single
  point of failure unless you do HA yourself.
- **Rejected because:** Solo / small team; the time spent on infra is
  better spent on the product.

### Alternative C: Kubernetes from day 1

- **Pros:** Cloud-portable; vendor-neutral.
- **Cons:** Massively over-engineered for early stage. Operational
  complexity dwarfs the application complexity.
- **Rejected because:** k8s earns its keep at scale (multi-cluster,
  multi-region, complex workloads). At 1-10 customers, the abstraction
  cost is pure overhead.

### Alternative D: Vercel + Supabase (or similar SaaS-only)

- **Pros:** Fastest possible time-to-market for a JS app.
- **Cons:** Heavy lock-in to Vercel's runtime (edge functions, ISR).
  Supabase is good but constrains schema decisions. Hard to migrate
  away.
- **Rejected because:** The portability constraint is the whole point.
  Vercel's good parts (great DX) come with the worst lock-in profile
  among the options.

## Consequences

### Positive

- Production live in days. The CISSPoder client onboards without ops
  delays.
- Migration trigger is explicit and the path is well-trodden: containers
  built for Fly run on ECS / Cloud Run / GKE with config-only changes.
- Phase 1+ doesn't need to revisit the deploy story — the application
  code already runs portably.

### Negative

- Some PaaS-specific cost overhead vs cloud-native at scale (~1.3-1.5×
  on Postgres specifically). Tolerable until ~$2k-5k/mo in DB cost.
- The portability constraint forbids some genuinely useful PaaS-native
  features (Fly Volumes, edge functions). Phase 0 / 1 don't need them.

### Neutral / informational

- The exact PaaS (Fly vs Railway vs Render) is chosen at Block 009
  (CI/CD). Fly is the strong recommendation given Node.js + Postgres
  ergonomics, but the constraint above holds regardless of choice.

## Validation

How we'll know this was correct:

- **Time-to-deploy:** first production deploy < 1 week from Phase 0
  start.
- **Migration trial:** a quarterly dry-run of "deploy `apps/api` to
  AWS ECS" should complete in < 1 day (config + Terraform; no code
  changes). This validates that lock-in hasn't crept in.
- **Reconsideration trigger:** when Postgres cost > $5k/mo, when a
  single-region PaaS becomes a latency problem for international
  customers, or when an enterprise customer requires VPC peering /
  on-premise hosting. Author ADR-NNNN to supersede.

## Implementation impact

- **New blocks required:** block-001 (constraint enforced in Dockerfile pattern),
  block-007 (apps/api Dockerfile), block-008 (apps/web Dockerfile),
  block-009 (CI workflow + PaaS deploy step).
- **Migrations required:** none.
- **Estimated effort:** M (constraints permeate Phase 0; explicit deploy
  config lands in Block 009).

## References

- [REPOSITORY_STRATEGY.md](../REPOSITORY_STRATEGY.md) — `apps/*` deployment notes
- [protocols/DATABASE.md](../protocols/DATABASE.md) — managed Postgres + connection pool sizing
- Bootstrap conversation 2026-05-15 — user choice: PaaS first, scale later
- [Fly.io docs](https://fly.io/docs/) — chosen PaaS recommendation (not binding)
