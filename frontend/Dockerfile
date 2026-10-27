# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate
ENV CI=true
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile --filter @scrapecat/frontend...

FROM deps AS builder
COPY frontend ./frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_DEMO_MODE=false
ARG NEXT_PUBLIC_ALLOW_ADD_REPOS=true
ENV NEXT_OUTPUT=standalone
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEMO_MODE=$NEXT_PUBLIC_DEMO_MODE
ENV NEXT_PUBLIC_ALLOW_ADD_REPOS=$NEXT_PUBLIC_ALLOW_ADD_REPOS
RUN pnpm --filter @scrapecat/frontend build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

RUN addgroup -S nodejs -g 1001 \
  && adduser -S nextjs -u 1001 \
  && mkdir -p /app/frontend \
  && chown nextjs:nodejs /app/frontend

COPY --chown=nextjs:nodejs --from=builder /app/frontend/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --chown=nextjs:nodejs --from=builder /app/frontend/public ./frontend/public

WORKDIR /app/frontend
USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]
