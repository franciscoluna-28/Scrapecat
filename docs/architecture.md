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
│     PostgreSQL + pgvector (projects, commits, reports)   │
│     Drizzle ORM · postgres-js driver                     │
│     Store layer per domain (src/projects/stores/, …)     │
│     Octokit (GitHub REST API)                            │
│     ──[future]──── GitLab · Bitbucket                    │
└─────────────────────────────────────────────────────────┘
```

## RAG (Vectors: partial, semantic search not shipped)

The commit corpus and embedding pipeline are real; semantic search over it is **not shipped yet**:

- `commit_chunks.diff_summary` holds a structured commit doc per commit (commit message + PR title + PR body excerpt), with `pr_title`, `pr_url`, `commit_url`, `files_changed`, and `metrics` stored in the `metadata` jsonb. **Full patch/diff text is never stored.**
- `content_hash` (SHA-256 of the doc) and `embedding_hash` gate re-embedding: a row's embedding is current iff `embedding_hash = content_hash`. `embedding vector(1536)` + the HNSW index (`commit_embedding_hnsw_idx`) are populated by the non-blocking `embedNewChunks()` (OpenRouter, `openai/text-embedding-3-small`, 1536 dims) invoked after report generation, plus the `embed:backfill` script for one-time catch-up. If no OpenRouter key is available the sync degrades gracefully and the backfill catches up later.
- There is no semantic-search endpoint (`cosineDistance` over the HNSW index is the planned path) and no prompt-enrichment/retrieval in report generation yet.

The full strategy (why, corpus shape, cost/reliability properties) is documented in [`docs/embeddings.md`](embeddings.md).

## Commit sync (background worker + DB-backed queue)

One background worker owns **all** commit ingestion. Reports (and future RAG) never touch the git provider — they delegate through `src/projects/sync-service.ts` and read from Postgres, which acts as a materialized view of each branch.

```
report generation / RAG      ──delegate──►  sync-service (enqueueSync / ensureSynced)
                                                │
                                                ▼
                                   sync_jobs queue (Postgres)
                                   status: pending → running → succeeded | failed
                                                │  claim (FOR UPDATE SKIP LOCKED)
                                                ▼
                                   sync worker (startSyncWorker)
                                   runProjectSync: advisory lock → paginate from
                                   watermark → dedupe → write chunks → advance watermark
                                   → embedNewChunks
                                                │
                                   read-only ▼
                                   report/RAG query commit_chunks from Postgres
```

**Two tables, two jobs:**

- `project_sync_state` — the **watermark**: per `(project_id, branch)` it stores `last_synced_commit_sha` + `last_synced_at`. This is the ingestion frontier. It only advances inside the sync transaction, so a run that dies mid-pagination restarts from the same watermark (re-fetched commits are deduped by SHA).
- `sync_jobs` — the **queue**: rows with `status` (`pending`/`running`/`succeeded`/`failed`), `attempts`, `last_error`, `scheduled_at`. `enqueueSyncJob` is idempotent (no duplicate while a pending/running job exists); `claimNextSyncJob` uses `FOR UPDATE SKIP LOCKED` so concurrent workers never double-run; `failSyncJob` reschedules with exponential backoff up to `SYNC_MAX_ATTEMPTS`.

**The freshness rule:** `ensureSynced` blocks until the watermark covers the needed point (report window end, in UTC) **or** a recent catch-up job reached the branch tip. The second condition matters because the watermark can never exceed GitHub's newest commit — if the branch simply has nothing after the requested date, a successful catch-up *is* synced. Without it, a report window ending after the last commit would enqueue jobs forever.

**Failure handling:** every step is idempotent. A failure on page N leaves the watermark where it was (transaction rollback), so the next attempt resumes from the watermark — no page index is persisted. Retries back off; permanent failures are recorded on the job row and surfaced via `ensureSynced` → `SyncError` (503).

**Status endpoint:** `GET /api/v1/projects/:id/sync` returns the watermark, latest job, and chunk/embedding totals — this drives the frontend "indexing…" state.

**Report generation guard:** never starts (not even the sync) without a valid AI provider key — stored credential or env fallback — otherwise `ProviderKeyError` (400).

## Tech Debt

The MVP solved one concrete problem as fast as possible. Every shortcut was intentional but now needs addressing.

### Git provider coupling

All external data flows through `src/shared/integrations/git-provider/` — an Octokit adapter with an interface. It's still imported directly by every consuming route/service (no DI), so adding GitLab or Bitbucket means touching each call site.

### Database coupling

The DB client is initialized at module load in `src/db/client.ts`. Access goes through per-domain stores (`src/projects/stores/`, `src/reports/stores/`, `src/credentials/stores/`) — routes never import `db` directly. The schema is a normalized model in `src/db/schema.ts`: `projects` (provider-generic: `git_provider` enum + `provider_project_id`/`provider_owner`, unique on `(git_provider, provider_project_id)`), `commit_chunks` (per-commit diffs + pgvector embedding), `project_sync_state` (per-branch sync watermark), `sync_jobs` (background sync queue), `reports`, `report_commits`, and `credentials`.

### No dependency injection

Services are imported at the top of files, not injected. Swapping implementations means changing import paths everywhere. Tests compensate with `vi.mock()`.

### No auth layer

The API has zero authentication. Fine for the MVP's trusted deployments. Impossible to open for multi-tenant SaaS without a full rework.

### Report generation (`src/reports/routes.ts`)

One ~160-line handler does validation, key resolution, sync delegation, AI retry loop, and report persistence. Should be extracted into a service.

- Commit sync is fully owned by the background worker (`runProjectSync` in `src/projects/sync.ts`, driven by the `sync_jobs` queue): paginated and unlimited (per_page is a page size; GitHub caps it at 100), advisory-locked, deduped against stored SHAs, watermark-advanced per `(project, branch)`. Report generation just calls `ensureSynced` and reads the window from `commit_chunks`.
- Commit reads are store-first: `GET /api/v1/reports/:id/commits` serves stored rows from `report_commits` + `commit_chunks`; `POST /api/v1/reports` waits on the worker, then reads the window from Postgres.

### Validation & data-integrity gaps

- `startDate`/`endDate` are unvalidated strings; invalid dates surface as generic 500s.
- `limit`/`per_page` on the discovery endpoints are validated (coerced ints, 1–100) so bad input fails fast with a 400 instead of propagating NaN to GitHub.
- `GET /repositories/*`, `/commits`, `/commits/count` hit GitHub live — discovery endpoints by design; the normalized read path is `GET /reports/:id/commits`.
- No transactions: project upsert and report create are separate writes; the commit sync runs in its own advisory-locked transaction. A mid-way failure leaves chunks persisted without a report (safe today — chunks are the cache — but should be intentional).

## What needs to happen

Decouple in three phases, no big-bang rewrites:

1. **Git provider interface** — extract an adapter behind a single interface so routes don't know or care whether data comes from GitHub, GitLab, or Bitbucket
2. **Data access layer** — store layer extracted into per-domain stores under each domain folder (`src/projects/stores/`, etc.); Postgres + pgvector provides the connected data model. The vector-search half of this (HNSW on `commit_chunks.embedding`) is infrastructure-ready but **WIP** — embeddings are populated, the `cosineDistance` search endpoint is not — see "RAG (Vectors: partial, semantic search not shipped)" above
3. **Dependency injection** — wire providers and stores into the app via Fastify's decorate mechanism so routes receive their dependencies instead of importing them

Each migration follows the same pattern: extract interface, write new implementation behind it, run both in parallel, flip the default, remove the old one.
