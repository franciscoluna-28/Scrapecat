# Backend Rules

Normative rules for working on the Fastify/TypeScript backend. Architecture and design rationale live in `docs/` — this file is only what you must know before changing code. Project-wide rules are in the root `AGENTS.md`.

## Commands

- Run API: `pnpm dev` (tsx watch on `src/index.ts`, port 4000, Swagger at http://localhost:4000/docs)
- Tests: `pnpm test` (vitest run)
- Watch tests: `pnpm test:watch`
- Postgres integration tests: `pnpm test:integration` (requires a live DB — see `docs/testing.md`)
- DB migrations: `pnpm db:generate` then `pnpm db:migrate`. **Never use `db:push`** — it bypasses migrations and won't create the `vector` extension or enum types. Always apply schema changes via generated migrations + `db:migrate`.
- Codegen (frontend types): `pnpm codegen` from project root — starts backend, runs openapi-typescript, stops backend

## API layer (per-domain `routes.ts` + `src/app.ts`)

Structure is routes → services, organized by **domain** (screaming architecture). Each domain folder (`src/reports/`, `src/projects/`, `src/repositories/`, `src/credentials/`, etc.) owns its handlers, Zod/TypeBox schemas, services, stores, and colocated tests. Cross-cutting integrations live in `src/shared/integrations/`; shared DB infra in `src/db/`.

**Imports use the `@/` alias** pointing at `src/` (e.g. `@/reports/routes`, `@/db/schema`, `@/shared/integrations/git-provider`) — never relative `../` paths. Resolved by tsconfig `paths` (`@/*` → `./src/*`), vitest `resolve.alias`, and `tsx` at runtime. New files must import via `@/`.

Route handlers stay thin; business logic goes in services.

All route registration is imperative in `src/app.ts` — each route specifies a `schema` object (TypeBox for OpenAPI generation) and a handler function imported from the owning domain (e.g. `src/reports/routes.ts`). There is no router/index.ts or decorator-based routing.

**Route handler pattern** (every handler must follow this):
1. Accept `req: FastifyRequest, reply: FastifyReply` — **never** use generic type parameters on `FastifyRequest<{ Params, Body, Querystring }>`; those are compile-only and provide no runtime safety
2. Parse params/query/body with Zod `safeParse` at the top of the handler
3. If parse fails, return `400` with `parsed.error.flatten()`
4. Call the appropriate service / git-provider method
5. Return data or catch with a generic `500`

Validation uses a **dual schema system**:
- **Zod** — runtime validation inside route handlers. Every param, query, and body must be parsed with a Zod schema. No `as` casts, no generic type assertions. Zod schemas live in each domain's `schemas.ts`.
- **TypeBox** — Fastify response serialization and OpenAPI spec generation. Registered in the route's `schema.response` in `app.ts`. TypeBox schemas live in each domain's `schemas.ts`; the shared error body is `ErrorResponse` in `src/shared/typebox.ts`.

Never return API key values from any endpoint — metadata only (key hints).

Errors: return standard `{ error: ... }` objects with appropriate HTTP status codes. No custom exception classes — use inline `reply.status(N).send(...)`.

CORS is open by default (env `CORS_ORIGIN`, default `http://localhost:3000`). No rate limiting built in. No authentication middleware — `GITHUB_TOKEN` is server-side only.

## AI / model provisioning (`src/reports/ai.ts` + `src/shared/integrations/providers/registry.ts`)

All LLM calls go through `callAI()` from `src/reports/ai.ts` — never instantiate provider SDKs directly.

Provider metadata (SDK type, default model, env key name, verify URL) lives in the registry: `src/shared/integrations/providers/registry.ts` `PROVIDER_REGISTRY`. The only supported SDK types are `openrouter` (uses `@openrouter/sdk`) and `openai-compatible` (uses `openai` package with custom base URL).

To add a provider: add an entry to `PROVIDER_REGISTRY`, add the env key default to `src/config/env.ts`.

API key resolution: `resolveApiKey()` in `src/credentials/services.ts` decrypts the most recent stored credential for a provider. Falls back to env vars if no credential exists. Keys are encrypted at rest with AES-256-GCM (`src/credentials/encryption.ts`).

Strip extended-thinking output with `cleanResponse()` before using model responses (removes `<thinking>` tags).

## Report generation flow (`src/reports/routes.ts`)

1. Validate input body with `reportInputBodySchema` (wraps `reportInputSchema` in `{ data: ... }`)
2. Upsert the project (`githubProjects` via `projects-store`, storing `github_owner`)
3. Sync commits via `syncCommitsForProject()` (`src/projects/sync.ts`): paginated, unlimited fetch (per_page is a page size, GitHub caps it at 100 — there is no hard system cap), run inside a per-project `pg_advisory_xact_lock` transaction, deduped against stored SHAs via `buildCommitChunks`, watermark advanced to the newest synced commit per `(project, branch)` in `project_sync_state`; fire-and-forget `embedNewChunks`
4. Build system prompt (with template instruction) + user prompt via `src/reports/prompts.ts`
5. Call AI with up to 2 retries if structure validation fails
6. Validate AI output structure with `validateReportStructure()` (parses markdown, validates against `parsedReportSchema`)
7. Store in Postgres via Drizzle ORM
8. Return `{ reportId, projectId }`

### Read-path model

The DB is the read model for commits once a project exists. GitHub is only consulted to sync **new** commits; a full GitHub fetch is the fallback only when nothing is stored.

- **Discovery** (repos/branches, pre-sync commit preview) hits GitHub live: `src/gitRepositories/routes.ts` (`/commits` returns a bounded single page; `limit`/`per_page` are validated ints 1–100)
- **Report commits** (`GET /api/v1/reports/:id/commits`): serves the report's stored commit rows from `report_commits` + `commit_chunks` (`reportCommitsStore.listCommitsForReport`). No GitHub call.
- **Report generation** (`POST /api/v1/reports`) is the single sync point — `syncCommitsForProject()` fetches the requested window (paginated, advisory-locked, watermark-advanced) and returns the window's commits for the prompt.

Report refinement (`replyToReport` in `src/reports/routes.ts`): same flow but reads the report's commits from `commitChunks` (project + date range) instead of a stored blob, prepends the existing report as assistant context and appends the user's follow-up as a refine prompt.

## Database (`src/db/`)

Uses `postgres` (postgres-js). Drizzle ORM with the PostgreSQL dialect + pgvector (`pgvector/pgvector` in docker-compose, extension `vector`).

Tables defined in `src/db/schema.ts`:
- **github_projects** — normalized projects (uuid PK, unique GitHub project id, owner, repo name, default branch)
- **commit_chunks** — one row per commit: message, author, `diff_summary`, optional `embedding` (vector(1536)), `metadata` jsonb; unique on `(project_id, commit_sha)` + HNSW index on embedding

> **RAG is WIP.** The `embedding` column and HNSW index are infrastructure only — no embedding provider or backfill job exists, so embeddings are always NULL. Do not write queries that assume vectors are populated.
- **reports** — generated reports linked to a project (uuid PK, title, markdown)
- **credentials** — encrypted API keys; `provider` is a `pgEnum` (`openai` | `openrouter` | `deepseek` | `github` | `gitlab`), `name` is unique

All DB access goes through per-domain store modules — `src/projects/stores/projects-store.ts` + `commit-chunks-store.ts`, `src/reports/stores/reports-store.ts`, `src/credentials/stores/credentials-store.ts` — routes never import `db` directly.

Migrations managed via `drizzle-kit` in `src/db/migrations/`. Run `pnpm db:generate` after schema changes, then `pnpm db:migrate` to apply them. **Never run `db:push`** — it does not run migration files, so `CREATE EXTENSION vector` and the `credential_provider` enum are never created and schema pushes fail with `type "vector" does not exist`.

`db:migrate` runs `src/db/migrate.ts` (the `drizzle-orm/postgres-js` migrator) instead of `drizzle-kit migrate`, which fails silently with the postgres driver on this setup. Migration files must stay self-contained: prepend `CREATE EXTENSION IF NOT EXISTS vector;` to every generated migration (idempotent). Do **not** re-create types that already exist — `credential_provider` and `vector` are created by the first migration (`0000_quiet_phantom_reporter.sql`); re-running `CREATE TYPE credential_provider` in a later migration fails with `42710 duplicate_object`.

**Always generate a new migration for schema changes — never modify an existing (already-applied) migration file.** Every schema change gets its own `db:generate` output (e.g. `0002_*.sql`); never edit `0000_*`, `0001_*`, etc. The only allowed edit to a freshly generated file is prepending the extension/type statements above, before it has been applied.

`DATABASE_URL` for migrations comes from `process.env` first, then `backend/.env` (via dotenv), then the default. Note the shell environment overrides `.env`.

## Provider naming (`src/shared/integrations/providers/registry.ts`)

Provider identifiers use the plain names (`openrouter`, `deepseek`, `openai`) in both the `PROVIDER_REGISTRY` and the `credential_provider` pgEnum (`openai` | `openrouter` | `deepseek` | `github` | `gitlab`). No aliasing layer.

## Git provider abstraction (`src/shared/integrations/git-provider/`)

Interface `GitProvider` in `provider.ts` with methods: `listRepositories`, `listBranches`, `listCommitsPage`, `listCommits`, `countCommits`, `verifyConnection`.

Pagination is provider-agnostic: adapters implement the page primitive `listCommitsPage(...) → Page<T>` (GitHub reads the `Link` header for `hasMore`); the shared driver in `pagination.ts` owns the loop — early-stop predicates, `maxPages`/`maxCommits`/deadline guards, bounded retry with backoff on transient failures (5xx/429/network), fail-fast on permanent errors (4xx), and SHA dedupe across page boundaries. `listCommits` is a bounded collector over the driver. `per_page` is a page size (GitHub max 100) — it is **not** a system limit.

Currently only `GithubAdapter` (`github-adapter.ts`) is implemented, using `@octokit/core` with throttling and retry plugins. Factory in `index.ts` returns a singleton via `getGitProvider()`.

## Credentials / encryption (`src/credentials/services.ts` + `encryption.ts`)

- `createCredential()` — validates provider support, encrypts key with AES-256-GCM (32-byte key from `ENCRYPTION_KEY`, 12-byte IV), stores with `maskApiKey()` hint
- `listCredentials()` — returns safe view (no encrypted keys), optional provider filter
- `deleteCredential()` — deletes by ID, returns boolean
- `verifyCredential()` — tests key against provider's verify endpoint via fetch
- `resolveApiKey()` — decrypts most recent credential for a provider; returns null if none found

Encryption output format: `base64url(iv + tag + ciphertext)`.

## Environment config (`src/config/env.ts`)

Zod-validated `process.env` with `.default()` for all optional fields. Non-defaulted required: `ENCRYPTION_KEY`. Warns on missing `OPENROUTER_API_KEY` and `GITHUB_TOKEN` but does not exit.

Key defaults: `PORT: 4000`, `HOST: "0.0.0.0"`, `DATABASE_URL: "postgres://scrapecat:scrapecat@localhost:5432/scrapecat"`, `CORS_ORIGIN: "http://localhost:3000"`.

## Testing

Vitest with colocated `*.test.ts` files. Route tests use `buildApp()` from `../app` then `app.inject()` for HTTP-level testing. Mock `../shared/integrations/git-provider` with `vi.mock()` at module scope. Pure unit tests (schemas, prompts, utils) call functions directly.

Test pattern:
```ts
import { buildApp } from "../app";
const app = await buildApp();
const res = await app.inject({ method: "GET", url: "/api/v1/..." });
expect(res.statusCode).toBe(200);
```

Test env defaults are seeded in `vitest.setup.ts` (`ENCRYPTION_KEY`, `DATABASE_URL`, etc.). The postgres client is lazy — importing it does not require a live DB.

## Environment knobs

| Variable | Meaning |
|---|---|
| `ENCRYPTION_KEY` | Required; any base64 32-byte string |
| `OPENROUTER_API_KEY` | For OpenRouter (warned if missing) |
| `GITHUB_TOKEN` | GitHub personal access token (warned if missing) |
| `AI_MODEL` | Default model override |
| `DEEPSEEK_API_KEY` | For DeepSeek provider |
| `OPENAI_API_KEY` | For OpenAI provider |
| `DATABASE_URL` | PostgreSQL connection string (default `postgres://scrapecat:scrapecat@localhost:5432/scrapecat`) |
| `CORS_ORIGIN` | CORS origin (default `http://localhost:3000`) |

## Deep dives

- `src/reports/report-output.ts` — AI markdown structure validation with Zod + hand-written parser
- `src/reports/prompts.ts` — all prompt builders and `FALLBACK_REPORT`
- `src/shared/integrations/git-provider/github-adapter.ts` — Octokit setup with throttling/retry
- `src/credentials/encryption.ts` — AES-256-GCM details
