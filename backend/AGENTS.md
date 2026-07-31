# Backend Rules

Normative rules for working on the Fastify/TypeScript backend. Architecture and design rationale live in `docs/` — this file is only what you must know before changing code. Project-wide rules are in the root `AGENTS.md`.

## Commands

- Run API: `pnpm dev` (tsx watch on `src/index.ts`, port 4000, Swagger at http://localhost:4000/docs)
- Tests: `pnpm test` (vitest run)
- Watch tests: `pnpm test:watch`
- DB migrations: `pnpm db:generate` then `pnpm db:migrate`. **Never use `db:push`** — it bypasses migrations and won't create the `vector` extension or enum types. Always apply schema changes via generated migrations + `db:migrate`.
- Codegen (frontend types): `pnpm codegen` from project root — starts backend, runs openapi-typescript, stops backend

## API layer (`src/routes/` + `src/app.ts`)

Structure is routes → services. Route handlers stay thin; business logic goes in services.

All route registration is imperative in `src/app.ts` — each route specifies a `schema` object (TypeBox for OpenAPI generation) and a handler function from `src/routes/`. There is no router/index.ts or decorator-based routing.

**Route handler pattern** (every handler must follow this):
1. Accept `req: FastifyRequest, reply: FastifyReply` — **never** use generic type parameters on `FastifyRequest<{ Params, Body, Querystring }>`; those are compile-only and provide no runtime safety
2. Parse params/query/body with Zod `safeParse` at the top of the handler
3. If parse fails, return `400` with `parsed.error.flatten()`
4. Call the appropriate service / git-provider method
5. Return data or catch with a generic `500`

Validation uses a **dual schema system**:
- **Zod** (`src/schemas/index.ts`) — runtime validation inside route handlers. Every param, query, and body must be parsed with a Zod schema. No `as` casts, no generic type assertions.
- **TypeBox** (`src/schemas/json.ts`) — Fastify response serialization and OpenAPI spec generation. Registered in the route's `schema.response` in `app.ts`.

Never return API key values from any endpoint — metadata only (key hints).

Errors: return standard `{ error: ... }` objects with appropriate HTTP status codes. No custom exception classes — use inline `reply.status(N).send(...)`.

CORS is open by default (env `CORS_ORIGIN`, default `http://localhost:3000`). No rate limiting built in. No authentication middleware — `GITHUB_TOKEN` is server-side only.

## AI / model provisioning (`src/services/ai.ts` + `src/providers/registry.ts`)

All LLM calls go through `callAI()` from `src/services/ai.ts` — never instantiate provider SDKs directly.

Provider metadata (SDK type, default model, env key name, verify URL) lives in the registry: `src/providers/registry.ts` `PROVIDER_REGISTRY`. The only supported SDK types are `openrouter` (uses `@openrouter/sdk`) and `openai-compatible` (uses `openai` package with custom base URL).

To add a provider: add an entry to `PROVIDER_REGISTRY`, add the env key default to `src/config/env.ts`.

API key resolution: `resolveApiKey()` in `src/services/credentials.ts` decrypts the most recent stored credential for a provider. Falls back to env vars if no credential exists. Keys are encrypted at rest with AES-256-GCM (`src/services/encryption.ts`).

Strip extended-thinking output with `cleanResponse()` before using model responses (removes `<thinking>` tags).

## Report generation flow (`src/routes/generate-report.ts`)

1. Validate input body with `reportInputBodySchema` (wraps `reportInputSchema` in `{ data: ... }`)
2. Fetch commits from GitHub via `getGitProvider().listCommits()` (max 100)
3. Enrich with PR data unless `quickMode` — fetches PR body for each commit via `getPullRequestForCommit()`
4. Upsert the project (`githubProjects` via `projects-store`) and normalize commits into `commitChunks` (`commit-chunks-store`), building `diff_summary` from per-commit diffs fetched via `getCommitDetails()`
5. Build system prompt (with template instruction) + user prompt via `src/services/prompts.ts`
6. Call AI with up to 2 retries if structure validation fails
7. Validate AI output structure with `validateReportStructure()` (parses markdown, validates against `parsedReportSchema`)
8. Extract images from PR bodies, upload to R2 via `src/services/r2.ts`
9. Store in Postgres via Drizzle ORM
10. Return `{ reportId, projectId }`

Report refinement (`src/routes/reply.ts`): same flow but reads the report's commits from `commitChunks` (project + date range) instead of a stored blob, prepends the existing report as assistant context and appends the user's follow-up as a refine prompt.

## Database (`src/db/`)

Uses `postgres` (postgres-js). Drizzle ORM with the PostgreSQL dialect + pgvector (`pgvector/pgvector` in docker-compose, extension `vector`).

Tables defined in `src/db/schema.ts`:
- **github_projects** — normalized projects (uuid PK, unique GitHub project id, repo name, default branch)
- **commit_chunks** — one row per commit: message, author, `diff_summary`, optional `embedding` (vector(1536), NULL until RAG phase), `metadata` jsonb; unique on `(project_id, commit_sha)` + HNSW index on embedding
- **reports** — generated reports linked to a project (uuid PK, title, markdown, image assets)
- **credentials** — encrypted API keys; `provider` is a `pgEnum` (`openai` | `openrouter` | `deepseek` | `github` | `gitlab`), `name` is unique

All DB access goes through the store layer in `src/db/stores/` (`projects-store`, `commit-chunks-store`, `reports-store`, `credentials-store`) — routes never import `db` directly.

Migrations managed via `drizzle-kit` in `src/db/migrations/`. Run `pnpm db:generate` after schema changes, then `pnpm db:migrate` to apply them. **Never run `db:push`** — it does not run migration files, so `CREATE EXTENSION vector` and the `credential_provider` enum are never created and schema pushes fail with `type "vector" does not exist`.

## Provider naming (`src/providers/registry.ts`)

Provider identifiers use the plain names (`openrouter`, `deepseek`, `openai`) in both the `PROVIDER_REGISTRY` and the `credential_provider` pgEnum (`openai` | `openrouter` | `deepseek` | `github` | `gitlab`). No aliasing layer.

## Git provider abstraction (`src/services/git-provider/`)

Interface `GitProvider` in `provider.ts` with methods: `listRepositories`, `listBranches`, `listCommits`, `getCommitDetails`, `countCommits`, `getPullRequestForCommit`, `verifyConnection`.

Currently only `GithubAdapter` (`github-adapter.ts`) is implemented, using `@octokit/core` with throttling and retry plugins. Factory in `index.ts` returns a singleton via `getGitProvider()`.

## Credentials / encryption (`src/services/credentials.ts` + `encryption.ts`)

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

Vitest with colocated `*.test.ts` files. Route tests use `buildApp()` from `../app` then `app.inject()` for HTTP-level testing. Mock `../services/git-provider` with `vi.mock()` at module scope. Pure unit tests (schemas, prompts, utils) call functions directly.

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
| `R2_*` | Cloudflare R2 config (optional, image uploads) |

## Deep dives

- `src/schemas/report-output.ts` — AI markdown structure validation with Zod + hand-written parser
- `src/services/prompts.ts` — all prompt builders and `FALLBACK_REPORT`
- `src/services/git-provider/github-adapter.ts` — Octokit setup with throttling/retry
- `src/services/encryption.ts` — AES-256-GCM details
