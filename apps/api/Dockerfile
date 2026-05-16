# syntax=docker/dockerfile:1.6

# WHY: ADR-0004 portability — multi-stage, PORT env, stateless, no PaaS-specific deps.
# WHY: Runtime uses `tsx` because @saas/observability ships TS source only (Block 003
# convention); a future block can introduce esbuild bundling to reach `node dist/index.js`.

FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/observability/package.json ./packages/observability/
RUN pnpm install --frozen-lockfile --filter @saas/api...

COPY packages/observability/tsconfig.json ./packages/observability/
COPY packages/observability/src ./packages/observability/src
COPY apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src
RUN pnpm --filter @saas/api typecheck


FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate \
  && apk add --no-cache wget

COPY --from=builder /repo/pnpm-lock.yaml /repo/pnpm-workspace.yaml /repo/package.json /repo/tsconfig.base.json ./
COPY --from=builder /repo/apps/api/package.json ./apps/api/
COPY --from=builder /repo/apps/api/tsconfig.json ./apps/api/
COPY --from=builder /repo/apps/api/src ./apps/api/src
COPY --from=builder /repo/packages/observability/package.json ./packages/observability/
COPY --from=builder /repo/packages/observability/tsconfig.json ./packages/observability/
COPY --from=builder /repo/packages/observability/src ./packages/observability/src
RUN pnpm install --frozen-lockfile --filter @saas/api...

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:${PORT}/health || exit 1

WORKDIR /app/apps/api
CMD ["pnpm", "exec", "tsx", "src/index.ts"]
