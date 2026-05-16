# Dockerfile pattern — shared notes

Both `apps/api/Dockerfile` and `apps/web/Dockerfile` follow the same multi-stage
build pattern. These notes document the constraints; the actual Dockerfiles land
in Blocks 007 and 008.

---

## Multi-stage structure

```dockerfile
# Stage 1 — dependency install (cached layer)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# Stage 2 — build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm turbo run build --filter=<app-name>

# Stage 3 — runtime (smallest possible image)
FROM node:22-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/apps/<app-name>/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
# ... copy only what the runtime needs
```

---

## Required conventions (portability constraints per ADR-0004)

### `PORT` environment variable

The app **must** listen on `process.env.PORT`. The PaaS injects the port at
runtime. Hardcoding `3000` or any other port is forbidden.

```dockerfile
ENV PORT=8080
EXPOSE $PORT
```

### `HEALTHCHECK`

Every production image must declare a health check. The PaaS uses it to route
traffic and restart unhealthy containers.

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:$PORT/health || exit 1
```

The `/health` endpoint is a contract between the app and the deploy layer. It
must return `200` when the process is ready to serve traffic.

### No platform-specific volumes

Do **not** add `VOLUME` directives or mount platform-specific persistent disks for
application data. Persistent state lives in managed Postgres only. Temporary file
I/O (uploads, caches) uses ephemeral disk that is recreated on each deploy — if
the app needs durable file storage, use an object store (S3-compatible).

### No platform-specific secrets

Do **not** bake secrets into the image. All secrets arrive as environment variables
at runtime (injected by the PaaS — `fly secrets`, Render env vars, Railway
variables). The image contains no credentials.

---

## Node version

Pin to `node:22-alpine` (matching `.nvmrc`). Use the `-alpine` variant to keep
image size minimal. Rebuild and redeploy when a Node 22 patch with security fixes
is released.

---

## Build args vs env vars

Use `ARG` only for build-time values that are not secrets (e.g., `NEXT_PUBLIC_*`
that must be baked into the frontend bundle). All runtime config is `ENV` /
process.env — never an `ARG` baked into the production image.
