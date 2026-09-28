# Deploying the Backend on Vercel

The backend deploys as a single Vercel Function (Fluid compute) using Vercel's
zero-config Fastify support. This is the **demo / serverless profile**
(`DEMO_MODE=true`, GitHub REST API ingestion) — the self-hosted archive mode is
not available on Vercel because functions have no persistent disk or `git`
binary.

## Why the extra build step

Vercel's Node runtime does **not** support tsconfig path mappings, and this
codebase imports via `@/`. So the app is bundled at build time into a single
alias-free file:

- `scripts/build-vercel.mjs` (esbuild) bundles `src/vercel-entry.ts` →
  `dist/vercel-entry.mjs`, resolving `@/` and leaving `node_modules` external.
- `server.mjs` (project root) is the detected entrypoint. It is plain
  JavaScript so Vercel's type-check of the entrypoint skips the untyped bundle.
  Vercel's Fastify detector requires the entry file to import `fastify`, so
  `server.mjs` creates the Fastify instance and starts the app factory exported
  by the bundle; the `app.listen()` call is what Vercel captures to route
  requests.
- The bundle is produced by the `build:vercel` script, wired as Vercel's Build
  Command in `backend/vercel.json`.
- The Fastify factory is named `src/build-app.ts` (not `app.ts`) so Vercel's
  Fastify entrypoint detection does not pick it up and run it directly — which
  would bypass the bundle and fail on the unresolved `@/` alias.

`dist/` is gitignored — it is generated on every deploy.

## Project settings

| Setting | Value |
|---|---|
| Root Directory | `backend` |
| Framework preset | Fastify / Other (auto-detected) |
| Build Command | `pnpm run build:vercel` (set in `vercel.json`) |
| Output Directory | leave default |
| Install Command | leave default (`pnpm` via the workspace lockfile) |

Do **not** set an output directory.

## Environment variables

Set these in the Vercel project (Production **and** Preview). See
[`docs/demo.md`](./demo.md) for the demo profile.

```bash
OPENROUTER_API_KEY=sk-or-...
ENCRYPTION_KEY=...                 # openssl rand -base64 32
DATABASE_URL=postgres://...        # pooled URL (Neon/Supabase pooler)
DATABASE_POOL_MAX=1                # serverless: one connection per instance
DATABASE_PREPARE=false             # false for transaction-mode poolers
DEMO_MODE=true
ALLOW_ADD_REPOS=true               # seed once, then set false to lock
CORS_ORIGIN=https://your-frontend.example.com
# GITHUB_TOKEN=...                 # optional, raises the anonymous rate limit
```

## Migrations

Run migrations out-of-band against the managed database — never from the
function:

```bash
pnpm --filter @scrapecat/backend db:migrate
```

## Duration & streaming

- Vercel Functions on Fluid compute default to a 300s max duration, which is
  enough for streamed LLM replies. No `vercel.json` is required — lower it via
  Project Settings → Functions if you want a tighter cap.
- Vercel Functions support response streaming, so SSE works, but verify with a
  real chat on the deployed URL.

## Verify

```bash
curl https://your-backend.example.com/api/v1/health   # {"status":"ok"}
curl https://your-backend.example.com/api/v1/meta
```

Then send a chat message from the frontend to exercise ingestion + SSE.
