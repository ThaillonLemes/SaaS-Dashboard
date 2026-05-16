FROM node:22-alpine AS builder

RUN npm install -g pnpm@9.15.9

WORKDIR /workspace

COPY pnpm-workspace.yaml ./
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY tsconfig.base.json ./

COPY apps/api/package.json ./apps/api/
COPY packages/observability/package.json ./packages/observability/
COPY packages/contracts/package.json ./packages/contracts/

RUN pnpm install --frozen-lockfile

COPY apps/api/ ./apps/api/
COPY packages/observability/ ./packages/observability/
COPY packages/contracts/ ./packages/contracts/

RUN pnpm --filter @saas/api build


FROM node:22-alpine AS runtime

WORKDIR /app

COPY --from=builder /workspace/apps/api/dist ./dist
COPY --from=builder /workspace/apps/api/package.json ./
COPY --from=builder /workspace/node_modules ./node_modules

ENV PORT=3000

EXPOSE 3000

HEALTHCHECK CMD wget -qO- http://localhost:$PORT/health || exit 1

CMD ["node", "dist/index.js"]
