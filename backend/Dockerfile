# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN apk add --no-cache git tini
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
ENV CI=true
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile --filter @scrapecat/backend...

FROM deps AS build
COPY backend ./backend
RUN pnpm --filter @scrapecat/backend build:docker

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile --prod --filter @scrapecat/backend...

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0
ENV REPO_ARCHIVE_DIR=/app/repos
WORKDIR /app/backend

COPY --from=prod-deps --chown=node:node /app/node_modules /app/node_modules
COPY --from=prod-deps --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/backend/package.json ./package.json
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY --from=build --chown=node:node /app/backend/src/db/migrations ./src/db/migrations
COPY --chown=node:node backend/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh \
  && mkdir -p /app/repos \
  && chown node:node /app/repos

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health/ready >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/app/backend/docker-entrypoint.sh"]
CMD ["node", "dist/main.mjs"]
