# Backend Rules

Normative rules for working on the Fastify/TypeScript backend. Architecture and design rationale live in `docs/` — this file is only what you must know before changing code. Project-wide rules are in the root `AGENTS.md`.

## Commands

- Run API: `pnpm dev` (tsx watch on `src/main.ts`, port 4000, Swagger at http://localhost:4000/docs)
- Vercel build (serverless demo): `pnpm build:vercel` bundles `src/vercel-entry.ts` → `dist/vercel-entry.mjs` via `scripts/build-vercel.mjs` (run automatically as `vercel-build`). The root `server.mjs` is Vercel's Fastify entrypoint (plain JS so Vercel's type-check skips the untyped bundle).
- Tests: `pnpm test` (vitest run)
- Watch tests: `pnpm test:watch`
- Postgres integration tests: `pnpm test:integration` (requires a live DB — see `docs/testing.md`)
- DB migrations: `pnpm db:generate` then `pnpm db:migrate`. **Never use `db:push`** — it bypasses migrations and won't create the `vector` extension or enum types. Always apply schema changes via generated migrations + `db:migrate`.
- Codegen (frontend types): `pnpm codegen` from project root — starts backend, runs openapi-typescript, stops backend

## API layer (per-domain `routes.ts` + `src/build-app.ts`)

Structure is routes → services, organized by **domain** (screaming architecture). Each domain folder (`src/projects/`, `src/repositories/`, `src/credentials/`, etc.) owns its handlers, Zod/TypeBox schemas, services, stores, and colocated tests. Cross-cutting infrastructure lives in `src/shared/` (`integrations/`, `storage/`, `queue/`); shared DB infra in `src/db/`.

**Imports use the `@/` alias** pointing at `src/` (e.g. `@/projects/routes`, `@/db/schema`, `@/shared/integrations/git-provider`) — never relative `../` paths. Resolved by tsconfig `paths` (`@/*` → `./src/*`), vitest `resolve.alias`, and `tsx` at runtime. New files must import via `@/`.

Route handlers stay thin; business logic goes in services.

All route registration is imperative in `src/build-app.ts` — each route specifies a `schema` object (TypeBox for OpenAPI generation) and a handler function imported from the owning domain (e.g. `src/projects/routes.ts`). There is no router/index.ts or decorator-based routing.

**Route handler pattern** (every handler must follow this):
1. Accept `req: FastifyRequest, reply: FastifyReply` — do **not** use generic type parameters on `FastifyRequest<{ Params, Body, Querystring }>`; validation is enforced at the route `schema` level, not via compile-time generics
2. Read `req.params`/`req.query`/`req.body` directly, typed with `Static<typeof X>` casts (e.g. `const { id } = req.params as Static<typeof ProjectIdParams>`) — Fastify already validated and applied defaults before the handler runs
3. Call the appropriate service / git-provider method
4. Return data or catch with a generic `500`

Validation uses **TypeBox-first, Fastify-owned validation**:
- **TypeBox** — the single source of truth for request validation, response serialization, and OpenAPI generation. Every route registers a `schema` object (TypeBox `params`/`querystring`/`body`/`response`) in `src/build-app.ts`; Fastify/Ajv validates requests *before* the handler runs (400 on failure) and serializes responses. TypeBox schemas live in each domain's `schemas.ts`; the shared error body is `ErrorResponse` in `src/shared/typebox.ts`.
- Handlers read `req.params`/`req.query`/`req.body` directly, typed with `Static<typeof X>` casts — no Zod schemas in the request path.
- A global `setErrorHandler` in `src/build-app.ts` maps validation failures to `{ error: string }` (matching `ErrorResponse`) so the error contract stays uniform.
- **Zod is reserved for non-request validation only:** `src/config/env.ts` (env parsing). Do not reintroduce Zod for route input.

Never return API key values from any endpoint — metadata only (key hints).

Errors: return standard `{ error: ... }` objects with appropriate HTTP status codes. No custom exception classes — use inline `reply.status(N).send(...)`.

CORS is open by default (env `CORS_ORIGIN`, default `http://localhost:3000`). No rate limiting built in. No authentication middleware — `GITHUB_TOKEN` is server-side only.

## AI / model provisioning (`src/chat/ai.ts` + `src/shared/integrations/providers/`)

All LLM calls go through `callAI()` from `src/chat/ai.ts` — never instantiate provider SDKs directly.

Provider metadata (label, default model/protocol, env key name, verify URL, base URLs, headers) lives in `src/shared/integrations/providers/registry.ts` `PROVIDER_REGISTRY`. The model catalog (`catalog.ts`) maps each model id to its transport protocol: `openai-chat`, `openai-responses`, `anthropic-messages`, or `google-generative`. `protocols.ts` is the only module that imports model SDKs (Vercel AI SDK); `createLanguageModel()` resolves the protocol and base URL for a model. This is how one provider (OpenCode Go) can serve models across several endpoints.

To add a provider: add an entry to `PROVIDER_REGISTRY` (with `defaultProtocol`, base URL(s), and any headers), add its models to `MODEL_CATALOG`, and add the env key default to `src/config/env.ts`.

API key resolution: `resolveApiKey()` in `src/credentials/services.ts` decrypts the most recent stored credential for a provider. Falls back to env vars if no credential exists. Keys are encrypted at rest with AES-256-GCM (`src/credentials/encryption.ts`).

Strip extended-thinking output with `cleanResponse()` before using model responses (removes `<thinking>` tags).

## Read-path model

The DB is the materialized read model for commits. The git archive (self-hosted, warm-cached by the archive store) or the public GitHub REST API (demo) is the ingestion source; the provider REST APIs are also used for discovery.

- **Discovery** (repos/branches) hits the connected providers live: `src/gitRepositories/routes.ts`. `GET /api/v1/repositories` fans out to every provider with a resolvable token (GitHub-only in demo), tags each row with `provider`, and merges by recency; passing `?provider=` still selects one host. The commit preview (`GET /repositories/:owner/:repo/commits` + `/commits/count`) is **Postgres-backed** (reads `commit_chunks`; unknown/un-ingested repos return empty) or **API-backed** in demo — see the route's `DEMO_MODE` branch.
- **Chat retrieval** (`POST /api/v1/chat/sessions/:id/messages`) ingests the branch via the job queue (see `src/shared/queue/`), then reads `commit_chunks`.

## Database (`src/db/`)

Uses `postgres` (postgres-js). Drizzle ORM with the PostgreSQL dialect + pgvector (`pgvector/pgvector` in docker-compose, extension `vector`).

Tables defined in `src/db/schema.ts`:
- **projects** — provider-generic projects (uuid PK, `git_provider` enum `github`/`gitlab`, `provider_project_id`, `provider_owner`, repo name, default branch; unique on `(git_provider, provider_project_id)`)
- **chat_sessions** — chat threads per project (uuid PK, `project_id` FK, title, nullable `anonymous_id` for per-visitor isolation)
- **commit_chunks** — one row per commit: message, author, optional `embedding` (vector(768)) whose source is `commit_message`, `content_hash`/`embedding_hash` (staleness gate), `metadata` jsonb; unique on `(project_id, commit_sha, branch)` + HNSW index on embedding
- **app_settings** — global AI model settings: `chat_provider`/`chat_model` (the RAG answer model) and `embedding_provider`/`embedding_model`.
- **credentials** — encrypted API keys; `provider` is a `pgEnum` (`openai` | `openrouter` | `deepseek` | `opencode-go` | `ollama` | `github` | `gitlab`), `name` is unique

All DB access goes through per-domain store modules — `src/projects/stores/projects-store.ts`, `commit-chunks-store.ts`, `src/credentials/stores/credentials-store.ts` — routes never import `db` directly.

## Commit ingestion (`src/repositories/`)

Commit ingestion runs as a deduped in-process job in `src/shared/queue/`. The caller enqueues `ingest-branch` and awaits `runAndWait`; the handler runs inline, and concurrent callers for the same project+branch attach to the in-flight run. There are two interchangeable paths, selected by `DEMO_MODE`:

- **Self-hosted (default)** — clone/extract a local `git` archive (warm-cached through the archive store).
- **Demo / serverless (`DEMO_MODE=true`)** — read public commits over the GitHub REST API with Octokit; no `git` binary or persistent disk, so it runs on serverless hosts.

- **Archive store** (`src/shared/storage/`): `ArchiveStore` is a warm cache for the branch clone — `fs` (default: local disk already is the archive), `s3` (one `tar.gz` object per branch written with a single atomic `PutObject`, with disposable job-scoped local scratch), `memory` (tests). `ensureArchive` (`archive-service.ts`) hydrates before cloning, clones/fetches with the native `git` binary (`--single-branch --no-checkout`, `repos/{owner}/{repo}/{branch}/`, `GITHUB_TOKEN` via `http.extraheader`), then dehydrates only when the tip changed. GitHub remains the source of truth. **Known gap:** deleting a project cascades in Postgres but orphans its archive (S3 object / fs clone); the cache is regenerable, so cleanup is manual.
- **Native git only** (`repositories/git.ts`): always shell out to the system `git` via `execFile` and keep it installed in the image (`backend/Dockerfile.dev`). Never swap in a JS git library (`isomorphic-git`, `nodegit`, …) — the off-event-loop, bounded-memory subprocess model is load-bearing (it underpins the in-process ingestion and large-repo safety). Rationale: `docs/architecture.md` → "Why native git".
- **Reader** (`git-reader.ts`): `listCommitsInRange` reads commits in a date window from the local `.git` with native `git log`. Files-changed per commit comes from native `git diff-tree` (`git-diff.ts`); the file names are stored in `metadata.filesChanged` (the chat prompt grounds on these, since a commit message can be uninformative).
- **Ingest orchestrator** (`ingest.ts`): `ingestCommits(source, opts)` owns the shared pipeline — dedupe by SHA (before any file-scope work; `commit_message` is the embedding source) → batched upsert of `commit_chunks` → `embedNewChunks`. A `CommitSource` supplies `listCommits`, `toChunkInputs`, and `batchSize`; the source also resolves its own `tipSha`.
- **Git source** (`git-source.ts`): `createGitCommitSource` — ensure archive → list window commits → per-commit file scope (`git diff-tree`, concurrency 8) → guardrail; upserts in batches of 50. `commitUrl` is `https://github.com/{owner}/{repo}/commit/{sha}`.
- **Demo API reads** (`github-api.ts`): `listCommitsFromApi` paginates `GET /repos/:owner/:repo/commits` (public-only; optionally uses `GITHUB_TOKEN` but works anonymously at 60 req/hr) and `getChangedFilesForShas` best-effort enriches file scopes. Shared Octokit construction lives in `shared/integrations/git-provider/octokit.ts`.
- **API source** (`api-source.ts`): `createApiCommitSource` feeds the same orchestrator using the API reads. File scopes are best-effort and the whole window upserts in a single batch; guardrail does **not** run here, so demo chunks carry no `metadata.validation`. Demo mode is hardened so it never calls user-scoped endpoints (`/user`, `/user/repos`) or exposes the token owner — see `src/gitConnections/services.ts`.
- **Database-first** (`projects/services.ts`): `prepareProjectBranch` serves from `commit_chunks` when the branch is already ingested (no GitHub call); otherwise it enqueues the `ingest-branch` job and awaits it. In demo it never throws — a rate-limit/network failure falls back to stored rows. Same fallback applies to the self-hosted path.
- **Demo branch scope** (`shared/demo-branches.ts`): demo only exposes/ingests `main`/`master` (or the repo's resolved default). `listBranches` filters the UI list and `prepareProjectBranch` skips ingestion for any other branch, so a visit can't fan out across every feature branch.
- **Read-only demo**: `DEMO_MODE=true` also implies `DEMO_RESTRICT_KEYS` (no BYOK). Repo-adding is controlled separately by `ALLOW_ADD_REPOS` (default true): leave it on to seed the database on first run, then set `ALLOW_ADD_REPOS=false` to lock visitors to the pre-ingested set.

Migrations managed via `drizzle-kit` in `src/db/migrations/`. Run `pnpm db:generate` after schema changes, then `pnpm db:migrate` to apply them. **Never run `db:push`** — it does not run migration files, so `CREATE EXTENSION vector` and the `credential_provider` enum are never created and schema pushes fail with `type "vector" does not exist`.

`db:migrate` runs `src/db/migrate.ts` (the `drizzle-orm/postgres-js` migrator) instead of `drizzle-kit migrate`, which fails silently with the postgres driver on this setup. Migration files must stay self-contained: prepend `CREATE EXTENSION IF NOT EXISTS vector;` to every generated migration (idempotent). Do **not** re-create types that already exist — `credential_provider` and `vector` are created by the first migration (`0000_quiet_phantom_reporter.sql`); re-running `CREATE TYPE credential_provider` in a later migration fails with `42710 duplicate_object`.

**Always generate a new migration for schema changes — never modify an existing (already-applied) migration file.** Every schema change gets its own `db:generate` output (e.g. `0002_*.sql`); never edit `0000_*`, `0001_*`, etc. The only allowed edit to a freshly generated file is prepending the extension/type statements above, before it has been applied.

`DATABASE_URL` for migrations comes from `process.env` first, then `backend/.env` (via dotenv), then the default. Note the shell environment overrides `.env`.

## Provider naming (`src/shared/integrations/providers/registry.ts`)

Provider identifiers use the plain names (`openrouter`, `deepseek`, `openai`, `opencode-go`) in both the `PROVIDER_REGISTRY` and the `credential_provider` pgEnum (`openai` | `openrouter` | `deepseek` | `opencode-go` | `ollama` | `github` | `gitlab`). No aliasing layer. OpenCode Go is chat-only (it exposes OpenAI Chat Completions, OpenAI Responses, and Anthropic Messages models); embeddings stay on OpenRouter/Ollama.

## Git provider abstraction (`src/shared/integrations/git-provider/`)

Interface `GitProvider` in `provider.ts` with methods: `listRepositories`, `searchPublicRepositories`, `listBranches`, `getDefaultBranch`, `getRepositoryId`, `verifyConnection`. **Discovery only** — commits are read from the local archive with the native `git` binary (`src/repositories/`), never from this interface. The default branch is resolved via the provider API (`default_branch`) — never hardcode `main`, since repos like next.js default to `canary`.

`GithubAdapter` (`github-adapter.ts`) uses `@octokit/core` with throttling and retry plugins; shared construction lives in `octokit.ts` (`createOctokit(token?)`, token optional for anonymous public access). `GitlabAdapter` (`gitlab-adapter.ts`) uses a thin native-`fetch` client in `gitlab-client.ts` (auth, timeout, bounded retry, `x-next-page` pagination) — deliberately not a GitLab SDK, since the discovery surface is small and we need retry/backoff the SDK does not provide. `GITLAB_HOST` selects the instance (default `https://gitlab.com`) and is used for API, web, and clone URLs; nested `group/subgroup/project` paths are URL-encoded. The factory `getGitProvider(provider, token?)` in `index.ts` returns the interface via the registry's `createAdapter`; the provider comes from the project/request (`project.gitProvider`), never a global env setting. The app-layer `GitProviderId` is defined in `registry.ts`, independent of the DB enum. Provider wiring lives in `registry.ts` (`getGitProviderConfig`): host, token env var, commit/clone URLs, clone auth header, and adapter factory. Unimplemented providers throw instead of silently falling back to GitHub. Token resolution goes through `resolveGitToken(provider)`; connection storage/verification lives in `src/gitConnections/`. Demo commit reads do not use this interface — they live in `src/repositories/github-api.ts`, and demo mode rejects non-GitHub providers (`gitRepositories/routes.ts`, `api-source.ts`).

Git connection API: `GET|POST|DELETE /api/v1/git-providers/:provider/connection` is the single token lifecycle for every provider (stored credential or env fallback). Do not add provider-specific connection routes.

## Credentials / encryption (`src/credentials/services.ts` + `encryption.ts`)

- `createCredential()` — validates provider support, encrypts key with AES-256-GCM (32-byte key from `ENCRYPTION_KEY`, 12-byte IV), stores with `maskApiKey()` hint
- `listCredentials()` — returns safe view (no encrypted keys), optional provider filter
- `deleteCredential()` — deletes by ID, returns boolean
- `verifyCredential()` — tests key against provider's verify endpoint via fetch
- `resolveApiKey()` — decrypts most recent credential for a provider; returns null if none found

Encryption output format: `base64url(iv + tag + ciphertext)`.

## Environment config (`src/config/env.ts`)

Zod-validated `process.env` with `.default()` for all optional fields. Non-defaulted required: `ENCRYPTION_KEY`. Warns on missing `OPENROUTER_API_KEY` (and `GITHUB_TOKEN`, except in demo mode where anonymous public access is fine) but does not exit.

Demo flags: `DEMO_MODE=true` (API ingestion + public-only hardening; implies `isDemoRestrictKeys`), `DEMO_RESTRICT_KEYS` (hide BYOK), `ALLOW_ADD_REPOS` (default true; set false to lock visitors to pre-ingested repos).

Key defaults: `PORT: 4000`, `HOST: "0.0.0.0"`, `DATABASE_URL: "postgres://scrapecat:scrapecat@localhost:5432/scrapecat"`, `CORS_ORIGIN: "http://localhost:3000"`.

## Testing

Vitest with colocated `*.test.ts` files. Route tests use `buildApp()` from `../app` then `app.inject()` for HTTP-level testing. Mock `../shared/integrations/git-provider` with `vi.mock()` at module scope. Pure unit tests (schemas, prompts, utils) call functions directly.

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
| `GITHUB_TOKEN` | GitHub personal access token (warned if missing); used for the archive clone |
| `GITLAB_TOKEN` | GitLab personal access token (`read_api`, `read_repository`); discovery + archive clone |
| `GITLAB_HOST` | GitLab instance origin (default `https://gitlab.com`); set for self-hosted |
| `AI_MODEL` | Default model override |
| `DEEPSEEK_API_KEY` | For DeepSeek provider |
| `OPENAI_API_KEY` | For OpenAI provider |
| `OPENCODE_GO_API_KEY` | For the OpenCode Go chat provider |
| `DATABASE_URL` | PostgreSQL connection string (default `postgres://scrapecat:scrapecat@localhost:5432/scrapecat`) |
| `CORS_ORIGIN` | CORS origin (default `http://localhost:3000`) |
| `REPO_ARCHIVE_DIR` | Directory for cloned repo archives (default `repos/`) |
| `ARCHIVE_STORE` | Warm cache: `fs` (default) \| `s3` \| `memory` (tests) |
| `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` / `S3_FORCE_PATH_STYLE` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_PREFIX` | S3 (or MinIO) archive cache settings |

## Deep dives

- `src/shared/storage/` — archive warm-cache adapters (`fs`/`s3`/`memory`) + tar helpers
- `src/shared/queue/` — in-process job queue, handler registry, and the `ingest-branch` job
- `src/repositories/` — archive clone/hydrate, git reading, ingestion orchestrator
- `src/shared/integrations/providers/` — provider registry, model catalog (id → protocol), AI SDK model factory
- `src/shared/integrations/git-provider/github-adapter.ts` — Octokit setup with throttling/retry (discovery only)
- `src/shared/integrations/git-provider/gitlab-client.ts` + `gitlab-adapter.ts` — GitLab REST client (auth/retry/pagination), self-hosted host, field mapping
- `src/credentials/encryption.ts` — AES-256-GCM details
