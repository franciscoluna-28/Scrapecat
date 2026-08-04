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

## RAG (Vectors: shipped, ingestion not shipped)

The commit corpus and embedding pipeline are real, and an experimental semantic-search + RAG answer endpoint ships:

- `commit_chunks.diff_summary` holds a structured commit doc per commit (commit message + PR title + PR body excerpt), with `pr_title`, `pr_url`, `commit_url`, `files_changed`, and `metrics` stored in the `metadata` jsonb. **Full patch/diff text is never stored.**
- `content_hash` (SHA-256 of the doc) and `embedding_hash` gate re-embedding: a row's embedding is current iff `embedding_hash = content_hash`. `embedding vector(1536)` + the HNSW index (`commit_embedding_hnsw_idx`) are populated by the non-blocking `embedNewChunks()` (OpenRouter, `openai/text-embedding-3-small`, 1536 dims) invoked after report generation, plus the `embed:backfill` script for one-time catch-up. If no OpenRouter key is available the sync degrades gracefully and the backfill catches up later.
- `POST /api/v1/chat/ask` (`src/chat/`) answers questions over a project's commits: embeds the question, runs `searchChunks()` (cosine `<=>` over the HNSW index), applies a date range extracted from the question (`extractDateFilter`, `src/chat/date-filter.ts`) plus a similarity threshold, and answers with the retrieved commits as citable `sources`. If nothing is retrieved (or the project isn't indexed), it refuses deterministically instead of calling the LLM.

The full strategy (why, corpus shape, cost/reliability properties) is documented in [`docs/embeddings.md`](embeddings.md).

### RAG ingestion (not shipped) — technical debt

The retrieval half works, but **there is no ingestion pipeline**. The corpus is only populated as a side effect of report generation (`createReportUseCase` → `syncProjectCommits`, `src/reports/use-cases/index.ts`), which is capped at `MAX_LIMIT=100` of the newest commits in the report window (`src/projects/sync.ts`). Consequences:

- A project that has never had a report generated has **zero** indexed commits, so `ask` can only ever return "no commits indexed".
- Even for reported projects, the corpus is a shallow window (≤100 commits); old-history questions ("when did we change auth", 2 years ago) are unreachable.
- There is no cold-start full backfill, no watermark-based incremental sync (steady-state cost ∝ new commits), and no explicit empty-repo handling.

**Fix direction (when we build it):** a `POST /api/v1/projects/:id/ingest` route that (1) cold-starts with a paginated, idempotent full backfill of GitHub history (resumable across calls via a `hasMore`/cursor), (2) warms up to incremental sync once a watermark exists, (3) treats an empty repo as a no-op, and (4) runs embeddings inline for accurate counts. Everything it needs is already in place: `getChunksByShas` dedupe, the `content_hash`/`embedding_hash` staleness gate, and `writeChunks` idempotency.

## Tech Debt

The MVP solved one concrete problem as fast as possible. Every shortcut was intentional but now needs addressing.

### Git provider coupling

All external data flows through `src/shared/integrations/git-provider/` — an Octokit adapter with an interface. It's still imported directly by every consuming route/service (no DI), so adding GitLab or Bitbucket means touching each call site.

### Database coupling

The DB client is initialized at module load in `src/db/client.ts`. Access goes through per-domain stores (`src/projects/stores/`, `src/reports/stores/`, `src/credentials/stores/`) — routes never import `db` directly. The schema is a normalized model in `src/db/schema.ts`: `github_projects`, `commit_chunks` (per-commit diffs + pgvector embedding), `reports`, and `credentials`.

### No dependency injection

Services are imported at the top of files, not injected. Swapping implementations means changing import paths everywhere. Tests compensate with `vi.mock()`.

### No auth layer

The API has zero authentication. Fine for the MVP's trusted deployments. Impossible to open for multi-tenant SaaS without a full rework.

### Report generation (`src/reports/routes.ts`)

One ~160-line handler does validation, GitHub fetch, chunk building, AI retry loop, and report persistence. Should be extracted into a service.

- Per-commit PR/detail enrichment (`getPullRequestForCommit`, `getCommitDetails`) only runs for SHAs not already stored, concurrency-limited to 6, and degrades gracefully on failure.
- Commit reads are store-first with GitHub delta sync: `GET /api/v1/reports/:id/commits` and `POST /api/v1/reports` share `syncProjectCommits()` (`src/projects/sync.ts`); a full GitHub fetch happens only when nothing is stored yet.

### Validation & data-integrity gaps

- `startDate`/`endDate` are unvalidated strings; invalid dates surface as generic 500s.
- `limit` in `GET /repositories/:owner/:repo/commits` is `parseInt`-ed without validation (NaN can propagate to GitHub).
- `GET /repositories/*`, `/commits`, `/commits/count` hit GitHub live — discovery endpoints by design; the normalized read path is `GET /reports/:id/commits`.
- No transactions: project upsert, chunk upsert, and report create are separate writes. A mid-way failure leaves chunks persisted without a report (safe today — chunks are the cache — but should be intentional).

## What needs to happen

Decouple in three phases, no big-bang rewrites:

1. **Git provider interface** — extract an adapter behind a single interface so routes don't know or care whether data comes from GitHub, GitLab, or Bitbucket
2. **Data access layer** — store layer extracted into per-domain stores under each domain folder (`src/projects/stores/`, etc.); Postgres + pgvector provides the connected data model. The vector-search half of this (HNSW on `commit_chunks.embedding`) is shipped for the experimental `ask` endpoint; the missing half is the **ingestion pipeline** — see "RAG ingestion (not shipped)" above
3. **Dependency injection** — wire providers and stores into the app via Fastify's decorate mechanism so routes receive their dependencies instead of importing them

Each migration follows the same pattern: extract interface, write new implementation behind it, run both in parallel, flip the default, remove the old one.
