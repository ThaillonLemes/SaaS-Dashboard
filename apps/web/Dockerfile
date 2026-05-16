# syntax=docker/dockerfile:1.6

# WHY: ADR-0004 portability — multi-stage, PORT env, stateless, no PaaS-specific deps.

FROM node:22-alpine AS builder
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @saas/web...

COPY apps/web/tsconfig.json apps/web/vite.config.ts apps/web/index.html ./apps/web/
COPY apps/web/src ./apps/web/src
RUN pnpm --filter @saas/web build


FROM caddy:2-alpine AS runtime
ENV PORT=8080
WORKDIR /srv

COPY --from=builder /repo/apps/web/dist /srv

RUN printf '%s\n' \
  ':{$PORT:8080} {' \
  '    root * /srv' \
  '    file_server' \
  '    try_files {path} /index.html' \
  '}' > /etc/caddy/Caddyfile

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q --spider http://localhost:${PORT}/ || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
