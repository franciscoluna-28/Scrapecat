```
┌─────────────────────────────────────────────────────────┐
│                   Presentation Tier                      │
│              Next.js 16 (React 19)                      │
│         TanStack Query · Tailwind · shadcn/ui           │
├─────────────────────────────────────────────────────────┤
│                    API Tier                              │
│            Fastify 5 · TypeBox · OpenAPI                │
│          Request validation · CORS · Swagger            │
├─────────────────────────────────────────────────────────┤
│                   Data Tier                              │
│     PostgreSQL + pgvector (read model: projects, commits)│
│     Drizzle ORM · postgres-js driver                     │
│     Store layer per domain (src/projects/stores/, …)     │
│     Archive store (fs | s3) · job queue (memory | bullmq)│
│     native git (clone/fetch) · Octokit (discovery only)  │
│     ──[future]──── GitLab · Bitbucket                    │
└─────────────────────────────────────────────────────────┘
```

## RAG (Vectors: partial, semantic search not shipped)

The commit corpus and embedding pipeline are real; semantic search over it is **not shipped yet**:

- `commit_chunks.commit_message` is the **embedding source** (commit/PR review, not code review — the message is the unit of meaning). `metadata` carries `files_changed` and `validation.status` (`confirmed`/`flagged`/`skipped`) + `notes` from the free rule guardrail.
- `content_hash` (SHA-256 of the message) and `embedding_hash` gate re-embedding: a row's embedding is current iff `embedding_hash = content_hash`. `embedding vector(768)` + the HNSW index (`commit_embedding_hnsw_idx`) are populated by the non-blocking `embedNewChunks()` (OpenRouter, `openai/text-embedding-3-small`) invoked after ingestion, plus the `embed:backfill` script for one-time catch-up. If no OpenRouter key is available ingestion degrades gracefully and the backfill catches up later.
- Semantic search (`cosineDistance` over the HNSW index) backs chat retrieval; there is no prompt-enrichment pass beyond retrieved chunks.

The full strategy (why, corpus shape, cost/reliability properties) is documented in [`docs/embeddings.md`](embeddings.md).

## Commit ingestion (queued, archive-based)

Commit ingestion is **batched and archive-based**, executed as a deduped job. The API enqueues `ingest-branch` and awaits the result; with `QUEUE_DRIVER=memory` (default) the job runs inline, with `bullmq` a Worker in the same process drains Redis. Postgres is the read model; the git archive (or the demo GitHub API) is the ingestion source.

```
ingest-branch job
   └─ projects/services.prepareProjectBranch → queue.enqueue + runAndWait
        └─ repositories/archive-service.ensureArchive(owner, repo, branch)
             hydrate from the archive store (fs no-op | s3 GetObject + untar)
             repos/{owner}/{repo}/{branch}/   (native git clone/fetch + GITHUB_TOKEN)
             dehydrate to the archive store when the tip changed
        ▼
   repositories/git-reader.listCommitsInRange(dir, ref, since, until)
        · commits in the window, read from the local .git
        · per-commit file scope (`git diff-tree --name-status`)
        ▼
   classify with the free rule guardrail (skip empty/junk; flag misleading)
        ▼
   upsert commit_chunks (dedupe by SHA; commit_message is the embedding source)
        →  embedNewChunks (batch)
```

**Why batch:** the workload needs *everything* (all metadata + file scopes) from a remote, rate-limited API. A clone collapses that into one idempotent fetch; every fragile per-item call (pagination, retries, 429s) disappears. The GitHub REST API is used only for **discovery** (repo/branch listing, connection check) and the clone itself.

**Dedupe by SHA:** re-running ingestion for the same window writes nothing new (upsert `ON CONFLICT DO NOTHING`-style by `(project_id, commit_sha, branch)`), and already-synced commits are skipped before any file-scope work.

**Failure handling:** the only remote step is the clone/fetch (retryable with backoff). Embeddings run as a separate, non-blocking step and never fail ingestion.

**Status:** there is no dedicated sync endpoint — ingestion is triggered by `prepareProjectBranch` (chat + `POST /projects/:id/branches/prepare`) through the job queue; archive freshness is implicit (hydrate → fetch-before-read → dehydrate).

### Why native git (not a JS git library)

`src/repositories/git.ts` shells out to the system `git` binary with `execFile`, and the binary is baked into the backend image (`backend/Dockerfile.dev`: `RUN apk add --no-cache git`). This is a deliberate constraint, not an implementation detail — do **not** replace it with `isomorphic-git`, `nodegit`, or another library.

- **Off-loop, bounded memory.** A separate C process means packfile inflation, delta resolution, and object-graph walking cost ~0 V8 heap and never block the event loop. That is what makes running a BullMQ Worker *in the API process* safe, and what keeps a large clone from OOMing the service.
- **Protocol maturity.** Shallow/single-branch clone, incremental fetch negotiation, packfiles, smart HTTP, `http.extraheader` auth, and fast `log`/`diff-tree` on huge repos are years of hardening we get for free.
- **Reproducibility.** Pinning git in the image gives identical clone/fetch behavior across dev, replicas, and prod.
- **Statelessness.** Git touches only the disposable job scratch and local refs; the process carries no git state, matching "nothing durable on the image."

Why the alternatives break the model:

- **`isomorphic-git` (pure JS)** runs on the event loop, so pack/delta CPU stalls every request and SSE frame in the process, and it builds object structures in the JS heap (memory spikes on large repos). Protocol/negotiation support is weaker, and it does not produce the stderr shapes we map to HTTP (`BranchNotFound` → 400).
- **`nodegit` / libgit2 bindings** are native addons: per-platform prebuilds and Node-ABI rebuilds, which break the single portable image and cannot run on Vercel/Lambda; libgit2 is also still in-process (no subprocess isolation) and trails git on newer protocol features.
- **Serverless cannot run the binary at all**, which is exactly why the demo uses the GitHub REST API. The clean split: the self-hosted image ships git; serverless does not and uses the API path.

## Tech Debt

The MVP solved one concrete problem as fast as possible. Every shortcut was intentional but now needs addressing.

### Git provider coupling

All external data flows through `src/shared/integrations/git-provider/` — an Octokit adapter with an interface. It's still imported directly by every consuming route/service (no DI), so adding GitLab or Bitbucket means touching each call site.

### Database coupling

The DB client is initialized at module load in `src/db/client.ts`. Access goes through per-domain stores (`src/projects/stores/`, `src/credentials/stores/`) — routes never import `db` directly. The schema is a normalized model in `src/db/schema.ts`: `projects` (provider-generic: `git_provider` enum + `provider_project_id`/`provider_owner`, unique on `(git_provider, provider_project_id)`), `commit_chunks` (commit message + file scope + pgvector embedding), and `credentials`. The `reports`/`report_commits`/`report_jobs` tables are legacy and unused.

### No dependency injection

Services are imported at the top of files, not injected. Swapping implementations means changing import paths everywhere. Tests compensate with `vi.mock()`.

### No auth layer

The API has zero authentication. Fine for the MVP's trusted deployments. Impossible to open for multi-tenant SaaS without a full rework.

### Validation & data-integrity gaps

- `startDate`/`endDate` are unvalidated strings; invalid dates surface as generic 500s.
- `limit`/`per_page` on the discovery endpoints are validated (coerced ints, 1–100) so bad input fails fast with a 400 instead of propagating NaN to the archive.
- `GET /repositories/*` and `/commits`/`/commits/count` are Postgres-backed in self-hosted mode (`commit_chunks`; unknown/un-ingested repos return empty) and API-backed in demo.
- No transactions: project upsert and chunk ingest are separate writes; the window ingest runs outside a transaction. A mid-way failure leaves chunks persisted (safe today — chunks are the cache).

### Diff grounding is file-level, not content-level

The report prompt is grounded on real, provable diff **scope** (files, line counts, commit link) — the commit message is demoted to a hint and flagged when it contradicts the diff (`git-diff.ts` computes the stats, `guardrail.ts` skips empty commits and flags junk/lying messages). Two deliberate shortcuts remain:

- **The report model never reads the patch hunks.** It knows *what/where* changed and *how much*, but the "why" is inferred from file paths + line counts + message + link, not from the changed lines themselves. A commit mislabeled as `refactor` that actually deletes a feature is only caught if the file paths reveal it. Closing this means condensing real hunks into the report prompt — a token cost we're deferring.
- **The embedding corpus is the commit message by design.** This is a commit/PR review tool, not a code reviewer: with clear conventional commits the message is a legitimate summary, so generating a diff-derived one via a batched LLM is **unnecessary**. Revisit only if search ships *and* message-based embeddings prove insufficient (the `embed:backfill` script already exists for one-time re-embedding).

## What needs to happen

Decouple in three phases, no big-bang rewrites:

1. **Git provider interface** — extract an adapter behind a single interface so routes don't know or care whether data comes from GitHub, GitLab, or Bitbucket
2. **Data access layer** — store layer extracted into per-domain stores under each domain folder (`src/projects/stores/`, etc.); Postgres + pgvector provides the connected data model. The vector-search half of this (HNSW on `commit_chunks.embedding`) is infrastructure-ready but **WIP** — embeddings are populated, the `cosineDistance` search endpoint is not — see "RAG (Vectors: partial, semantic search not shipped)" above
3. **Dependency injection** — wire providers and stores into the app via Fastify's decorate mechanism so routes receive their dependencies instead of importing them

Each migration follows the same pattern: extract interface, write new implementation behind it, run both in parallel, flip the default, remove the old one.
