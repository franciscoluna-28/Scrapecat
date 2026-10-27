# Architecture

Scrapecat is a RAG chat over a repository's git history. Commits are ingested into
Postgres (the read model), embedded, and retrieved by semantic + keyword search
to ground an LLM answer.

## Tiers

```mermaid
flowchart TB
    subgraph P["Presentation"]
        FE["Next.js 16 · React 19<br/>TanStack Query · Tailwind · shadcn/ui"]
    end
    subgraph A["API"]
        API["Fastify 5 · TypeBox · OpenAPI<br/>validation · CORS · Swagger"]
    end
    subgraph D["Data"]
        PG["PostgreSQL + pgvector<br/>projects · commit_chunks · chat"]
        STORE["Per-domain stores (routes never touch db directly)"]
        INFRA["Archive store (fs | s3) · in-process job queue<br/>native git (clone/fetch) · Octokit / GitLab REST (discovery only)"]
    end
    FE --> API --> PG
    API --> STORE --> PG
    API --> INFRA
    INFRA -.->|future| EXT["Bitbucket"]
```

## RAG pipeline

`POST /api/v1/chat/sessions/:id/messages` ingests the branch if needed, then
retrieves, then streams the answer.

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Chat route
    participant Q as Job queue
    participant DB as Postgres
    participant LLM as callAI()

    C->>API: message + branch
    API->>Q: prepareProjectBranch (ingest if not stored)
    Q->>DB: upsert commit_chunks → embedNewChunks
    API->>DB: retrieveCommits(query, branch, window)
    DB-->>API: ranked citations (vector, keyword fallback)
    API->>LLM: system prompt + retrieved commits + question
    LLM-->>C: streamed tokens (SSE)
    API->>DB: persist assistant message + citations
```

- **Vector search** is the primary path (`cosineDistance` over the HNSW index,
  ceiling `MAX_COSINE_DISTANCE = 0.8`); **keyword search** is the fallback when
  embeddings are missing or the vector query fails. Retrieval limit: `20`.
- **Date windows** ("last 30 days", "since June") are parsed into metadata
  filters; temporal keywords with no explicit date anchor on the latest commit.
- **Grounding** is the commit message plus file scope — see [`embeddings.md`](embeddings.md).

## Commit ingestion

Batched, run as a deduped in-process job. The job selects a `CommitSource` — the
self-hosted git archive (`createGitCommitSource`) or the demo GitHub API
(`createApiCommitSource`) — and a shared orchestrator (`ingestCommits`) runs the
pipeline either way. Callers enqueue `ingest-branch` and await it; the handler
runs inline, and concurrent callers for the same project+branch attach to the
in-flight run.

```mermaid
flowchart TD
    J["ingest-branch job"] --> P["prepareProjectBranch → enqueue + runAndWait"]
    P --> E["ensureArchive(owner, repo, branch)"]
    E --> H["hydrate (fs no-op | s3 GetObject + untar)"]
    H --> G["native git clone/fetch → repos/{owner}/{repo}/{branch}/"]
    G --> DH["dehydrate when tip changed"]
    G --> R["listCommitsInRange(dir, ref, since, until)"]
    R --> S["per-commit file scope (git diff-tree --name-status)"]
    S --> CL["guardrail: skip empty/junk, flag misleading"]
    CL --> U["upsert commit_chunks (dedupe by SHA)"]
    U --> EM["embedNewChunks (batch, non-blocking)"]
```

- **Two sources:** `createGitCommitSource` (self-hosted; native git + per-commit
  diffs + guardrail, 50-row batches) and `createApiCommitSource` (demo; GitHub
  REST with best-effort file scopes, a single batch, no guardrail) both feed the
  same `ingestCommits` orchestrator.
- **Why batch:** the workload needs everything from a rate-limited API; one clone
  collapses it into a single idempotent fetch. GitHub REST is used only for
  **discovery** (repo/branch listing, connection check) and the clone itself.
- **Dedupe by SHA:** re-running a window writes nothing new; already-synced
  commits are skipped before file-scope work.
- **Failure handling:** the only remote step is clone/fetch (retryable).
  Embeddings are a separate, non-blocking step and never fail ingestion.

### Why native git (not a JS git library)

`src/repositories/git.ts` shells out to the system `git` binary with `execFile`,
baked into the image (`backend/Dockerfile.dev`). Do **not** replace it with
`isomorphic-git`, `nodegit`, etc.:

- **Off-loop, bounded memory** — a separate C process keeps pack/delta work off
  the V8 heap, which is what makes an in-process Worker safe and large clones
  non-OOMing.
- **Protocol maturity** — shallow/single-branch clone, incremental fetch,
  packfiles, `http.extraheader` auth, fast `log`/`diff-tree` on huge repos.
- **Reproducibility** — pinning git gives identical behavior across dev,
  replicas, and prod.
- **Statelessness** — git touches only disposable job scratch, matching "nothing
  durable on the image."

Serverless cannot run the binary at all — which is why the demo uses the GitHub
REST API. The clean split: self-hosted ships git; serverless does not and uses
the API path.

## Operational safety

- **Bounded LLM calls.** `callAI()` applies `AI_TIMEOUT_MS` to every chat request;
  embedding calls use the same timeout with one retry. SSE handlers abort the
  upstream call when the client disconnects.
- **Graceful shutdown.** `SIGTERM`/`SIGINT` close the Fastify server, which drains
  active ingest jobs (bounded to 10s) before exiting.
- **Readiness.** `GET /api/v1/health/ready` runs `select 1` against Postgres and
  returns 503 when it cannot connect; `GET /api/v1/health` stays a liveness probe.
  Docker images use the readiness route for their healthcheck.
- **Fail fast on config.** `ENCRYPTION_KEY` is validated as base64-encoded 32
  bytes at startup instead of failing at the first encrypt/decrypt call.

## Model resolution

Two roles, each with a provider + model setting stored in `app_settings`:

| Role | Setting | Default |
|---|---|---|
| Chat (RAG answer) | `chatProvider` / `chatModel` | `openrouter` / `env.AI_MODEL` |
| Embeddings | `embeddingProvider` / `embeddingModel` | `openrouter` / `env.EMBEDDING_MODEL` |

Precedence: a per-conversation override (chat only) → stored `app_settings` row →
`defaultAISettings()` (env defaults). All LLM calls go through `callAI()` in
`src/chat/ai.ts`; embeddings through `embedTexts()` in `src/projects/embeddings.ts`.
Each `commit_chunks` row stores its embedding provider/model, and retrieval only
searches vectors in the current space; changing the embedding model enqueues a
background reindex.

Chat model ids are resolved through the provider catalog
(`src/shared/integrations/providers/catalog.ts`), which records each model's
transport protocol (`openai-chat`, `openai-responses`, `anthropic-messages`, or
`google-generative`). `protocols.ts` is the only module that imports model SDKs;
`callAI()` hands it the registry config, catalog entry, and key, and it returns
the AI SDK language model. This is what lets a single provider (OpenCode Go)
expose models across different endpoints without special-casing in the call
path.

## Tech debt

Every shortcut below is intentional and tracked, not accidental.

### Git provider coupling

External data flows through `src/shared/integrations/git-provider/`. The
registry owns each provider's URLs, clone auth, env key, and client factory;
`getGitProvider(provider, token)` returns the interface, never a concrete
adapter. Connection routes are provider-generic
(`/api/v1/git-providers/:provider/connection`) and all token precedence lives in
`resolveGitToken`. Adding a provider is a registry entry plus an adapter, not a
call-site sweep — GitLab (`GitlabAdapter` + a thin `fetch` client, self-hosted
via `GITLAB_HOST`) was exactly that. Full DI is deliberately unused: the
registry/factory is the seam and is enough for one adapter per provider.

### Database coupling

The DB client is initialized at module load in `src/db/client.ts`. Access goes
through per-domain stores; routes never import `db` directly.

### No dependency injection

Services are imported at the top of files, not injected. Swapping implementations
means changing import paths everywhere; tests compensate with `vi.mock()`. This
is acceptable while each role has one implementation; revisit only when a real
multi-tenant/runtime plugin need appears.

### No auth layer

The API has zero authentication — fine for trusted self-hosted deployments,
impossible to open as multi-tenant SaaS without a rework.

### Production Docker images

Self-hosted clients build `backend/Dockerfile` and `frontend/Dockerfile` from the
workspace root; `docker-compose.prod.yml` wires them to Postgres with health-gated
startup. The backend image bundles `src/main.ts` and the migration runner with
esbuild, installs production dependencies only, ships the native `git` binary,
runs as `node`, and applies migrations on boot. The frontend builds Next's
standalone output (only when `NEXT_OUTPUT=standalone`, set by the Dockerfile) and
runs `server.js` as `nextjs`; the serverless Vercel path does not set that flag
and is unchanged (see [`deploy-vercel.md`](deploy-vercel.md)). Full instructions:
[`deployment.md`](deployment.md).

### Validation & data-integrity gaps

- `limit`/`per_page` on discovery endpoints are validated (1–100) and fail fast.
- No transactions: project upsert and chunk ingest are separate writes. A mid-way
  failure leaves chunks persisted (safe today — chunks are the cache).

### Unbounded pending embedding reads

`embedNewChunks` loads every pending row for a project with
`listPendingChunks(projectId)` before embedding them in batches. The write side
is set-based (one `UPDATE ... FROM unnest(...)` per batch), but the read side is
not bounded.

This is an accepted trade-off at the current scale: pending normally means the
commits from the current ingest, re-runs find almost nothing, and the demo caps
commits. It becomes a memory risk with very large repositories or a persistent
embedding backlog. `EMBEDDING_BATCH_SIZE` bounds the vectors held per batch, not
the pending row list.

If this becomes measurable, replace the single read with a bounded loop
(`LIMIT batchSize` until empty) or a keyset/cursor. Do not add a surrounding
transaction: the pipeline is idempotent and each batch write is atomic.

### Diff grounding is file-level, not content-level

The prompt is grounded on provable diff **scope** (files, line counts, commit
link); the commit message is a hint, flagged when it contradicts the diff. The
chat model never reads patch hunks, and the embedding corpus is the commit
message by design (this is commit/PR review, not code review). Revisit only if
message-based retrieval proves insufficient — the `embed:backfill` script already
handles one-time re-embedding.

## What needs to happen

Decouple in phases, no big-bang rewrites:

1. **Git provider interface** — done: the registry/factory returns the interface,
   and provider-generic connection routes own auth.
2. **Data access layer** — per-domain stores (already largely in place); vector
   search infrastructure is ready.
3. **Next provider** — GitLab is done (gitlab.com by default, `GITLAB_HOST` for
   self-hosted). Demo ingestion remains GitHub-only; a Bitbucket adapter would
   follow the same registry/adapter pattern.

Full DI is not on the roadmap: the factory is the seam, and injecting services
would add ceremony without a second consumer. Each future migration: implement
behind the interface → keep the default → remove the old path when unused.
