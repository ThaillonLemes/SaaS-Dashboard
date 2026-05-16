# Deploy infrastructure

Owned by the DevOps Agent (`infrastructure/deploy/`). Do not edit without a block manifest.

**Authoritative reference:** [`decisions/ADR-0004-deploy.md`](../../decisions/ADR-0004-deploy.md) —
PaaS-first, portable. Read it before changing any deploy configuration.

---

## Approach: PaaS-first, portable

Initial production target is a managed PaaS — **Fly.io is recommended** (Railway
and Render are acceptable alternatives). The application is architected to move
to AWS / GCP / self-hosted Kubernetes via a config change only — no code rewrites.

The operator chooses the concrete PaaS and wires deploy secrets. This block
documents constraints and placeholders only.

---

## Portability constraints (binding from Block 001 forward)

These are **non-negotiable** per ADR-0004. Any deploy configuration that violates
them requires a new ADR to supersede ADR-0004.

| Constraint | Requirement |
|------------|-------------|
| Config | Environment variables only (`process.env`). No platform-specific config files. |
| Filesystem | Stateless processes. No persistent local disk. |
| Database | Managed Postgres only. No PaaS-specific data features (no Fly Volumes, no Render Disks). |
| Secrets | Injected as env vars at runtime. No platform-specific secret stores in application code. |
| Static assets | `apps/web` builds to `dist/`. Served via PaaS edge or CDN. No platform edge-function lock-in. |
| Background jobs | Postgres-backed queue (pg-boss) or generic broker — never a platform-specific scheduler. |
| Observability | Logs to stdout. Metrics via OpenTelemetry OTLP. Not platform-specific drain/metrics. |
| Container | Standard multi-stage Dockerfile. Runs on Fly Machines, ECS, Cloud Run, or Kubernetes unchanged. |

---

## Recommended PaaS: Fly.io

- Fly Machines: good Node.js + Postgres ergonomics.
- Fly Postgres: managed, single-region initially, promotable to multi-region.
- Fly Secrets: `fly secrets set KEY=value` injects at runtime as env vars.
- Fly Metrics: forward to an OTLP endpoint; do NOT use as the sole observability layer.

[Railway](https://railway.app) and [Render](https://render.com) are drop-in
alternatives — the app's portability constraints ensure compatibility with both.

---

## Per-app deploy (placeholder — operator action)

The operator picks the PaaS, creates apps, and wires secrets. The Dockerfiles
live in each app's directory (Blocks 007 and 008). This section will be filled
in by the operator once the PaaS is chosen.

### `apps/api`

```bash
# Placeholder — operator fills in after choosing PaaS.
# Fly.io example:
#   fly launch --name saas-api --dockerfile apps/api/Dockerfile
#   fly secrets set DATABASE_URL=... PORT=8080 NODE_ENV=production
#   fly deploy
```

### `apps/web`

```bash
# Placeholder — operator fills in after choosing PaaS.
# Fly.io example:
#   fly launch --name saas-web --dockerfile apps/web/Dockerfile
#   fly secrets set API_URL=https://saas-api.fly.dev
#   fly deploy
```

---

## Migration trigger to AWS / GCP

Per ADR-0004, reconsider when **any one** of:

- Managed Postgres cost exceeds **~$5k/month** (RDS at scale is cheaper).
- A customer requires **VPC peering, on-premise hosting**, or data-residency in a
  region the PaaS doesn't serve.
- **Multi-region active-active** latency requirements can't be met by the PaaS.

When the trigger hits, author `decisions/ADR-NNNN-deploy-v2.md` to supersede
ADR-0004. The migration is expected to be a Dockerfile + Terraform change — no
application code changes — if the portability constraints above have been honored.

---

## Dockerfile pattern

See [`Dockerfile.shared-notes.md`](Dockerfile.shared-notes.md) for the multi-stage
build pattern shared by `apps/api` and `apps/web`.
