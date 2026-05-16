FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.7.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install

FROM base AS dev
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["pnpm", "run", "dev"]

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG GITHUB_TOKEN
ARG GROQ_API_KEY
ENV GITHUB_TOKEN=$GITHUB_TOKEN
ENV GROQ_API_KEY=$GROQ_API_KEY
RUN pnpm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=builder /app/src/drizzle ./src/drizzle

COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["pnpm", "run", "start"]
