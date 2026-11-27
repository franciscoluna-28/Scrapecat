# Backend Rules

Normative rules for working on the Fastify/TypeScript backend. Architecture and design rationale live in `docs/` — this file is only what you must know before changing code. Project-wide rules are in the root `AGENTS.md`.

## Commands

- Run API: `pnpm dev` (tsx watch on `src/main.ts`, port 4000, Swagger at http://localhost:4000/docs)
- Vercel build (serverless demo): `pnpm build:vercel` bundles `src/vercel-entry.ts` → `dist/vercel-entry.mjs` via `scripts/build-vercel.mjs` (run automatically as `vercel-build`). The root `server.mjs` is Vercel's Fastify entrypoint (plain JS so Vercel's type-check skips the untyped bundle).
- Typecheck: `pnpm typecheck` (`tsc --noEmit`)
- Tests: `pnpm test` (vitest run)
- Watch tests: `pnpm test:watch`
- Full local check: `pnpm check` from the project root (typecheck + lint + tests)
- Docker build bundle: `pnpm build:docker` (`main.mjs` + `migrate.mjs`); the normal `build` stays `tsc` for CI/Vercel
- Postgres integration tests: `pnpm test:integration` (requires a live DB — see `docs/testing.md`)
- Retrieval eval: `pnpm eval` (optionally `--prepare` to ingest the golden-set branch; see `docs/evaluation.md`)
- DB migrations: `pnpm db:generate` then `pnpm db:migrate`. **Never use `db:push`** — it bypasses migrations and won't create the `vector` extension or enum types. Always apply schema changes via generated migrations + `db:migrate`.
- Codegen (frontend types): `pnpm codegen` from project root — builds the Fastify app in-process, writes a temporary OpenAPI spec, and runs openapi-typescript; no backend server or database needed

## API layer (per-domain Fastify plugins + `src/startup/register-routes.ts`)

Structure is routes → services, organized by **domain** (screaming architecture), grouped by tier:

- `src/api/` — HTTP domains (`chat`, `credentials`, `repositories`, `settings`, `reports`, `system`). Each owns its handlers, route plugins, TypeBox schemas, services, stores, and colocated tests.
- `src/rag/` — the retrieval/indexing pipeline (`answer`, `context`, `retrieval`, `indexing`, `git`, `github`, `eval`).
- `src/shared/` — cross-cutting infrastructure (`integrations/`, `queue/`, `config/`, `utils/`, `plugins/`).
- `src/startup/` — server composition (`create-server.ts`, `register-routes.ts`).
- `src/db/` — DB client, schema, and migrations.

**Imports use the `@/` alias** pointing at `src/` (e.g. `@/api/repositories/routes`, `@/db/schema`, `@/shared/integrations/git-provider`) — never relative `../` paths. Resolved by tsconfig `paths` (`@/*` → `./src/*`), vitest `resolve.alias`, and `tsx` at runtime. New files must import via `@/`.

Route handlers stay thin; business logic goes in services.

Each HTTP domain exports a `FastifyPluginAsyncTypebox` that owns its routes, schemas, guards, and rate-limit config. `src/startup/register-routes.ts` only composes them under `/api/v1` (and applies API-scoped helmet). `src/build-app.ts` is the public composition entrypoint: it creates the server (`src/startup/create-server.ts`) and registers routes. There is no router/index.ts or decorator-based routing.

**Route handler convention** (every handler must follow this):
1. Declare the endpoint's schema once in the domain `schemas.ts` as a `*Route` constant (`{ tags, description, params, querystring, body, headers, response } satisfies FastifySchema`). **Every input the handler reads must be in the schema** — path params, query, body, and any custom headers.
2. Type the handler with that schema: `req: TypeBoxRequest<typeof FooRoute>, reply: TypeBoxReply<typeof FooRoute>` (from `@/shared/fastify`). `req.params`/`req.query`/`req.body`/`req.headers` are inferred from the schema — never cast, never re-validate by hand.
3. Register `app.METHOD("/path", { schema: FooRoute }, handler)` inside the domain's `FastifyPluginAsyncTypebox`.
4. Return the response payload: `return data`, or `reply.code(201); return data` for non-200s, or `reply.code(204); return;`. Do **not** `return reply.send(...)` — the typed reply requires the declared response payload union.
5. Throw `httpErrors.*` (from `@/shared/errors`) for failures. Do not catch-and-send `500` in handlers.

Validation uses **TypeBox-first, Fastify-owned validation**:
- **TypeBox** is the single source of truth for request validation, response serialization, and OpenAPI generation. TypeBox schemas and `*Route` constants live in each domain's `schemas.ts`; the shared error body is `ErrorResponse` in `src/shared/typebox.ts`.
- Fastify/Ajv validates requests *before* the handler runs (400 on failure) and serializes responses against the declared schema. Types are provided by `@fastify/type-provider-typebox` (applied in `src/startup/create-server.ts`). Do **not** enable `TypeBoxValidatorCompiler` — Ajv must keep handling `format: "uuid" | "date" | "date-time"`.
- The global `setErrorHandler` in `src/startup/create-server.ts` maps any thrown `statusCode` to `{ error: string }` (matching `ErrorResponse`) and logs 5xx without leaking internal messages.
- **Zod is reserved for non-request validation only:** `src/shared/config/env.ts` (env parsing). Do not reintroduce Zod for route input.

Never return API key values from any endpoint — metadata only (key hints).

Errors: throw `httpErrors.notFound(...)`, `.badRequest(...)`, `.forbidden(...)`, `.conflict(...)`, etc. (`@/shared/errors`). Services may throw the same constructors when the status is part of the domain contract. Use the `preHandler` guards in `src/shared/guards.ts` for demo/write restrictions instead of inline `if (env.isDemoMode)` checks.

CORS is open by default (env `CORS_ORIGIN`, default `http://localhost:3000`). Per-IP rate limiting is registered globally (`RATE_LIMIT_MAX`) with a tighter limit on chat (`CHAT_RATE_LIMIT_MAX`). No authentication middleware — `GITHUB_TOKEN` is server-side only, and the API is intended for trusted networks only.

Fastify plugins live in `src/startup/create-server.ts`: `@fastify/cors`, `@fastify/rate-limit`, `@fastify/request-context`, `@fastify/swagger(-ui)`, `@fastify/sensible` (reply helpers + `httpErrors`), `@fastify/compress` (global), and `@fastify/sse` (streaming). Streaming routes opt in with the route option `sse: 'manual'` (the endpoint always streams) and use `reply.sse.send(...)`; the plugin owns the raw response, heartbeat, header transfer, and close. Never hand-roll `reply.hijack()` for SSE. `@fastify/helmet` is registered only in the `/api/v1` scope so Swagger UI at `/docs` is not blocked. `@fastify/rate-limit` per-route overrides are declared in the owning domain plugin.

Liveness is `GET /api/v1/health`; readiness is `GET /api/v1/health/ready`, which runs `select 1` against Postgres and returns 503 when the database is unavailable. Docker healthchecks use the readiness route.

## AI / model provisioning (`src/rag/answer/ai.ts` + `src/shared/integrations/providers/`)

All LLM calls go through `aiClient.generate()` / `aiClient.stream()` from `src/rag/answer/ai.ts` (built by `createAIClient()`) — never instantiate provider SDKs directly. `resolveChatModel()` wires settings, provider metadata, and keys. The RAG stages are `retriever.resolveScope()` (`createRetriever()` in `src/rag/retrieval/retrieve.ts`) → prompt assembly (pure functions) → `turnResolver` → `aiClient.stream()` (web chat) or `aiClient.generate()` (stateless MCP/CLI). `createChatService()` owns the stateful web path; `createAnswerService()` owns the stateless one. Dependencies are injectable.

### Chat turn seam (web chat + MCP)

`src/rag/answer/turn.ts` is the transport-agnostic turn resolver: project lookup, branch selection, retrieval, model resolution, and prompt assembly. It must not import `src/api/chat/services`, create sessions, write messages, or touch Fastify/SSE. `src/api/chat/services.ts` is the stateful web facade (sessions, history, streaming, persistence); `src/rag/answer/answer.ts` is the stateless one-shot path for MCP/CLI. Changes to persona, retrieval, prompts, or model selection belong in `turn.ts` so both clients stay consistent. MCP tools must never import `src/api/chat/services`, and must not trigger ingestion unless explicitly designed to.

Provider metadata (label, default model/protocol, env key name, verify URL, base URLs, headers) lives in `src/shared/integrations/providers/registry.ts` `PROVIDER_REGISTRY`. The model catalog (`catalog.ts`) maps each model id to its transport protocol: `openai-chat`, `openai-responses`, `anthropic-messages`, or `google-generative`. `protocols.ts` is the only module that imports model SDKs (Vercel AI SDK); `createLanguageModel()` resolves the protocol and base URL for a model. This is how one provider (OpenCode Go) can serve models across several endpoints.

To add a provider: add an entry to `PROVIDER_REGISTRY` (with `defaultProtocol`, base URL(s), and any headers), add its models to `MODEL_CATALOG`, and add the env key default to `src/shared/config/env.ts`.

API key resolution: `resolveApiKey()` in `src/api/credentials/services.ts` decrypts the most recent stored credential for a provider. Falls back to env vars if no credential exists. Keys are encrypted at rest with AES-256-GCM (`src/api/credentials/encryption.ts`).

Chat sessions are scoped by the `x-anonymous-id` header: reading, streaming, or deleting a session owned by another id returns 404 so session existence is not leaked. Input is bounded by the TypeBox schemas (uuid project/session ids, 10k message cap).

Embeddings are fixed-width: `EMBEDDING_DIMENSIONS` in `src/shared/utils/embedding.ts` is the single source for `commit_embeddings.embedding` and the embedding request. OpenRouter accepts the OpenAI `dimensions` override; Ollama does not (`embeddingDimensionsParam` in the provider registry), so its model must natively emit that width. The response is always length-checked. LLM summaries are currently disabled, so the embedded text is `commitEmbeddingText(filesChanged, message)` — file paths plus the original message. When summaries are re-enabled, switch this back to `files + summary`.

Pure helpers live in `src/shared/utils/` (`index.ts` is the public surface). Stores and services own I/O and orchestration; they import generic helpers instead of exporting them. Domain-specific pure helpers (e.g. `toSafeCredential`, `defaultAISettings`) stay in their domain file — they are intentionally not global utilities.

## Read-path model

The DB is the materialized read model for commits. The local git clone (self-hosted) or the public GitHub REST API (demo) is the ingestion source; the provider REST APIs are also used for discovery.

- **Discovery** (repos/branches) hits the connected providers live: `src/api/repositories/discovery.ts`. `GET /api/v1/repositories` fans out to every provider with a resolvable token (GitHub-only in demo), tags each row with `provider`, and merges by recency; passing `?provider=` still selects one host. The commit preview (`GET /repositories/:owner/:repo/commits` + `/commits/count`) is **Postgres-backed** (reads `commit_embeddings`; unknown/un-ingested repos return empty) or **API-backed** in demo — see the route's `DEMO_MODE` branch.
- **Chat retrieval** (`POST /api/v1/chat/sessions/:id/messages`) ingests the branch via the job queue (see `src/shared/queue/`), then reads `commit_embeddings`.

## Database (`src/db/`)

Uses `postgres` (postgres-js). Drizzle ORM with the PostgreSQL dialect + pgvector (`pgvector/pgvector` in docker-compose, extension `vector`).

Tables defined in `src/db/schema.ts`:
- **projects** — provider-generic projects (uuid PK, `git_provider` enum `github`/`gitlab`, `provider_project_id`, `provider_owner`, repo name, default branch; unique on `(git_provider, provider_project_id)`)
- **project_branches** — per-branch ingest state (`project_id`+`branch` PK, `tip_sha`, `last_commit_at`, `last_ingested_at`); drives the tip-skip check and incremental `since` window
- **chat_sessions** — chat threads per project (uuid PK, `project_id` FK, title, nullable `anonymous_id` for per-visitor isolation)
- **commit_embeddings** — one row per `(repo_id, branch, commit_sha)`: original `message`, nullable `summary`/`summary_version`/`summary_model` (not written while LLM summaries are disabled), `author`, `committed_at`, `commit_url`, `files_changed text[]`, `diff_hash`, optional `embedding` (vector(768)) whose source is currently `files_changed + message`, `embedding_provider`/`embedding_model`, `content_hash`/`embedding_hash`, and a `search_vector` (summary A when present, files B, message C) written by the store because generated columns cannot use `array_to_string`; its GIN index backs the lexical channel. A row is current when its provider/model match the active settings and `embedding_hash = content_hash`. No raw diff is stored; citations redirect to `commit_url`.
- **app_settings** — global AI model settings: `chat_provider`/`chat_model` (the RAG answer model) and `embedding_provider`/`embedding_model`.
- **credentials** — encrypted API keys; `provider` is a `pgEnum` (`openai` | `openrouter` | `deepseek` | `opencode-go` | `ollama` | `github` | `gitlab`), `name` is unique
- **jobs** — durable background work (`type`, `status`, `payload`/`result`/`progress` jsonb, attempts, `run_at`, `idempotency_key`); unique partial index on `idempotency_key` for queued/running rows so concurrent callers dedupe

All DB access goes through per-domain store modules — `src/api/repositories/stores/projects-store.ts`, `src/rag/indexing/commit-embeddings-store.ts`, `src/api/credentials/stores/credentials-store.ts`, `src/api/settings/stores/settings-store.ts`, `src/api/chat/chat-store.ts` — routes never import `db` directly. Each store exports a `createXStore(client?: DbOrTx)` factory plus a default `xStore` singleton; methods bind the client once and take flattened arguments, so tests can inject a fake client instead of mocking the module.

## Commit ingestion (`src/rag/`)

Commit ingestion runs as durable, deduped jobs backed by the Postgres `jobs` table (`src/shared/queue/`). Job names and id builders live in `src/shared/queue/jobs.ts` (`JOB_NAMES`, `ingestBranchJobId`, `REINDEX_EMBEDDINGS_JOB_ID`); producers and handlers import them instead of string literals. Project log messages live in `src/rag/indexing/log-events.ts`. Callers `enqueueJob(...)` then `waitForJob(...)`; the stable idempotency key makes concurrent callers for the same project+branch attach to the same run. The worker (`worker.ts`) claims due jobs with `FOR UPDATE SKIP LOCKED` in the API process (`main.ts`, gated by `WORKER_ENABLED`); serverless runs the handler inline. This first version targets one process and one database, not replicas or horizontal scale: the worker takes a Postgres advisory lock at startup (a second replica serves API only), and on boot it fails any `running` rows left by a crash (queued rows survive) rather than re-queuing them or recovering stale locks at runtime. There are two interchangeable paths, selected by `DEMO_MODE`:

- **Self-hosted (default)** — clone the branch into a temporary workspace, delete it when the job ends.
- **Demo / serverless (`DEMO_MODE=true`)** — read public commits over the GitHub REST API with Octokit; no `git` binary or persistent disk, so it runs on serverless hosts.

- **Repository service** (`src/rag/git/git-repository-service.ts`): `gitRepositoryService.tip` uses `git ls-remote` + `project_branches` to skip cloning unchanged branches. `.open` clones with the native `git` binary (`--single-branch --no-checkout --filter=blob:none`, `GITHUB_TOKEN` via `http.extraheader`) into `os.tmpdir()/scrapecat/<uuid>` and returns a handle with `listCommits`, `changedFiles`, `commitUrl`, and `dispose`. `.sweep` clears crashed jobs on worker boot. The pipeline never calls `runGit`, clone URLs, or token resolution directly. No persistent clone lives on disk — the clone is a per-job workbench, Postgres is the durable read model. See `docs/architecture.md` → "Why no persistent clone cache".
- **Native git only** (`src/rag/git/git.ts`): always shell out to the system `git` via `execFile` and keep it installed in the images (`backend/Dockerfile.dev`, `backend/Dockerfile`). Never swap in a JS git library (`isomorphic-git`, `nodegit`, …) — the off-event-loop, bounded-memory subprocess model is load-bearing (it underpins the in-process ingestion and large-repo safety). Rationale: `docs/architecture.md` → "Why native git".
- **Reader** (`git-reader.ts`): `listCommitsInRange` reads commits in a date window from the local `.git` with native `git log`. The diff reader (`commit-diff.ts` + `git-repository-service.ts`) runs `git diff --numstat` / `git diff --patch --unified=3` against the first parent, excludes lockfiles/build/vendor/generated files, caps per file and in total, and hashes the cleaned `stat + patch`.
- **Summary service** (`commit-summary-service.ts`): deferred. The diff-grounded summarizer remains in the codebase but the ingest path does not call it while LLM summaries are disabled.
- **Ingest orchestrator** (`ingest.ts`): `ingestCommits(source, opts)` owns the shared pipeline — list commits → read diff → embed `files + message` → upsert `commit_embeddings`. No summary call and no summary writes. Changing `embeddingProvider`/`embeddingModel` enqueues `reindex-embeddings`, which re-embeds pending rows from stored messages.
- **Git source** (`git-source.ts`): `createGitCommitSource` — open workspace → list window commits → per-commit diff read. `commitUrl` is provider-aware.
- **Demo API reads** (`github-api.ts`): `listCommitsFromApi` paginates `GET /repos/:owner/:repo/commits` (public-only; optionally uses `GITHUB_TOKEN` but works anonymously at 60 req/hr) and `getChangedFilesForShas` returns file patches/stats. Shared Octokit construction lives in `src/shared/integrations/git-provider/octokit.ts`.
- **API source** (`api-source.ts`): `createApiCommitSource` feeds the same orchestrator using GitHub `files[].patch`; it applies the same exclusions and caps as the git source. Demo mode is hardened so it never calls user-scoped endpoints (`/user`, `/user/repos`) or exposes the token owner — see `src/api/credentials/git-connections.ts`.
- **Database-first** (`src/api/repositories/services.ts`): `prepareProjectBranch` serves from `commit_embeddings` when the branch is already ingested (no GitHub call); otherwise it enqueues the durable `ingest-branch` job and awaits it. In demo it never throws — a rate-limit/network failure falls back to stored rows. Same fallback applies to the self-hosted path.
- **Demo branch scope** (`src/shared/demo-branches.ts`): demo only exposes/ingests `main`/`master` (or the repo's resolved default). `listBranches` filters the UI list and `prepareProjectBranch` skips ingestion for any other branch, so a visit can't fan out across every feature branch.
- **Read-only demo**: `DEMO_MODE=true` also implies `DEMO_RESTRICT_KEYS` (no BYOK). Repo-adding is controlled separately by `ALLOW_ADD_REPOS` (default true): leave it on to seed the database on first run, then set `ALLOW_ADD_REPOS=false` to lock visitors to the pre-ingested set.

Migrations managed via `drizzle-kit` in `src/db/migrations/`. Run `pnpm db:generate` after schema changes, then `pnpm db:migrate` to apply them. **Never run `db:push`** — it does not run migration files, so `CREATE EXTENSION vector` and the `credential_provider` enum are never created and schema pushes fail with `type "vector" does not exist`.

`db:migrate` runs `src/db/migrate.ts` (the `drizzle-orm/postgres-js` migrator) instead of `drizzle-kit migrate`, which fails silently with the postgres driver on this setup. Only the first migration (`0000_quiet_phantom_reporter.sql`) creates the `vector` extension; do **not** prepend `CREATE EXTENSION IF NOT EXISTS vector;` to later migrations. Do **not** re-create types that already exist — `credential_provider` and `vector` are created by the first migration (`0000_quiet_phantom_reporter.sql`); re-running `CREATE TYPE credential_provider` in a later migration fails with `42710 duplicate_object`.

**Always generate a new migration for schema changes — never modify an existing (already-applied) migration file.** Every schema change gets its own `db:generate` output (e.g. `0002_*.sql`); never edit `0000_*`, `0001_*`, etc. The only allowed edit to a freshly generated file is prepending the extension/type statements above, before it has been applied.

`DATABASE_URL` for migrations comes from `process.env` first, then `backend/.env` (via dotenv), then the default. Note the shell environment overrides `.env`.

## Provider naming (`src/shared/integrations/providers/registry.ts`)

Provider identifiers use the plain names (`openrouter`, `deepseek`, `openai`, `groq`, `opencode-go`) in both the `PROVIDER_REGISTRY` and the `credential_provider` pgEnum (`openai` | `openrouter` | `groq` | `deepseek` | `opencode-go` | `ollama` | `github` | `gitlab`). No aliasing layer. OpenCode Go is chat-only (it exposes OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages models); embeddings stay on OpenRouter/Ollama.

## Git provider abstraction (`src/shared/integrations/git-provider/`)

Interface `GitProvider` in `provider.ts` with methods: `listRepositories`, `searchPublicRepositories`, `listBranches`, `getDefaultBranch`, `getRepositoryId`, `verifyConnection`. **Discovery only** — commits are read from an ephemeral clone with the native `git` binary (`src/rag/`), never from this interface. The default branch is resolved via the provider API (`default_branch`) — never hardcode `main`, since repos like next.js default to `canary`.

`GithubAdapter` (`github-adapter.ts`) uses `@octokit/core` with throttling and retry plugins; shared construction lives in `octokit.ts` (`createOctokit(token?)`, token optional for anonymous public access). `GitlabAdapter` (`gitlab-adapter.ts`) uses a thin native-`fetch` client in `gitlab-client.ts` (auth, timeout, bounded retry, `x-next-page` pagination) — deliberately not a GitLab SDK, since the discovery surface is small and we need retry/backoff the SDK does not provide. `GITLAB_HOST` selects the instance (default `https://gitlab.com`) and is used for API, web, and clone URLs; nested `group/subgroup/project` paths are URL-encoded. The factory `getGitProvider(provider, token?)` in `index.ts` returns the interface via the registry's `createAdapter`; the provider comes from the project/request (`project.gitProvider`), never a global env setting. The app-layer `GitProviderId` is defined in `registry.ts`, independent of the DB enum. Provider wiring lives in `registry.ts` (`getGitProviderConfig`): host, token env var, commit/clone URLs, clone auth header, and adapter factory. Unimplemented providers throw instead of silently falling back to GitHub. Token resolution goes through `resolveGitToken(provider)`; connection storage/verification lives in `src/api/credentials/`. Demo commit reads do not use this interface — they live in `src/rag/github/github-api.ts`, and demo mode rejects non-GitHub providers (`src/api/repositories/discovery.ts`, `api-source.ts`).

Git connection API: `GET|POST|DELETE /api/v1/git-providers/:provider/connection` is the single token lifecycle for every provider (stored credential or env fallback). Do not add provider-specific connection routes.

## Credentials / encryption (`src/api/credentials/services.ts` + `encryption.ts`)

- `createCredential()` — validates provider support, encrypts key with AES-256-GCM (32-byte key from `ENCRYPTION_KEY`, 12-byte IV), stores with `maskApiKey()` hint
- `listCredentials()` — returns safe view (no encrypted keys), optional provider filter
- `deleteCredential()` — deletes by ID, returns boolean
- `verifyCredential()` — tests key against provider's verify endpoint via fetch
- `resolveApiKey()` — decrypts most recent credential for a provider; returns null if none found

Encryption output format: `base64url(iv + tag + ciphertext)`.

## Environment config (`src/shared/config/env.ts`)

Zod-validated `process.env` with `.default()` for all optional fields. Non-defaulted required: `ENCRYPTION_KEY`. Warns on missing `OPENROUTER_API_KEY` (and `GITHUB_TOKEN`, except in demo mode where anonymous public access is fine) but does not exit.

Demo flags: `DEMO_MODE=true` (API ingestion + public-only hardening; implies `isDemoRestrictKeys`), `DEMO_RESTRICT_KEYS` (hide BYOK), `ALLOW_ADD_REPOS` (default true; set false to lock visitors to pre-ingested repos).

Key defaults: `PORT: 4000`, `HOST: "0.0.0.0"`, `DATABASE_URL: "postgres://scrapecat:scrapecat@localhost:5432/scrapecat"`, `CORS_ORIGIN: "http://localhost:3000"`.

## Testing

Vitest with colocated `*.test.ts` files. Route tests use `buildApp()` from `@/build-app` then `app.inject()` for HTTP-level testing. Mock `@/shared/integrations/git-provider` with `vi.mock()` at module scope. Pure unit tests (schemas, prompts, utils) call functions directly.

Test pattern:
```ts
import { buildApp } from "@/build-app";
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
| `GITHUB_TOKEN` | GitHub personal access token (warned if missing); used for the clone |
| `GITLAB_TOKEN` | GitLab personal access token (`read_api`, `read_repository`); discovery + clone |
| `GITLAB_HOST` | GitLab instance origin (default `https://gitlab.com`); set for self-hosted |
| `AI_MODEL` | Default model override |
| `AI_TIMEOUT_MS` | LLM/embedding request timeout in milliseconds (default `120000`) |
| `AI_MAX_OUTPUT_TOKENS` | Default chat output-token ceiling (default `8192`); applied by `aiClient` when a caller omits `maxTokens` |
| `DEEPSEEK_API_KEY` | For DeepSeek provider |
| `OPENAI_API_KEY` | For OpenAI provider |
| `GROQ_API_KEY` | For the Groq chat provider |
| `OPENCODE_GO_API_KEY` | For the OpenCode Go chat provider |
| `DATABASE_URL` | PostgreSQL connection string (default `postgres://scrapecat:scrapecat@localhost:5432/scrapecat`) |
| `CORS_ORIGIN` | CORS origin (default `http://localhost:3000`) |
| `WORKER_ENABLED` | Run the in-process durable job worker (default `true`); set `false` for API-only replicas |

## Deep dives

- `src/shared/queue/` — Postgres-backed job store, in-process worker, handler registry, and the `ingest-branch`/`reindex-embeddings` jobs
- `src/rag/` — ephemeral workspace, git reading, commit diffs/summaries, ingestion orchestrator
- `src/rag/git/commit-diff.ts` — diff filtering, capping, and hashing
- `src/rag/indexing/commit-embeddings-store.ts` — the commit read model + retrieval queries
- `src/rag/indexing/commit-summary-service.ts` — deferred diff-grounded summarizer (not called in the current ingest path)
- `src/shared/integrations/providers/` — provider registry, model catalog (id → protocol), AI SDK model factory
- `src/shared/integrations/git-provider/github-adapter.ts` — Octokit setup with throttling/retry (discovery only)
- `src/shared/integrations/git-provider/gitlab-client.ts` + `gitlab-adapter.ts` — GitLab REST client (auth/retry/pagination), self-hosted host, field mapping
- `src/api/credentials/encryption.ts` — AES-256-GCM details
