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

## Tech Debt

The MVP solved one concrete problem as fast as possible. Every shortcut was intentional but now needs addressing.

### Git provider coupling

All external data flows through `src/shared/integrations/git-provider/` — an Octokit adapter with an interface. It's still imported directly by every consuming route/service (no DI), so adding GitLab or Bitbucket means touching each call site.

### Database coupling

The DB client is initialized at module load in `src/db/client.ts`. Access goes through per-domain stores (`src/projects/stores/`, `src/reports/stores/`, `src/credentials/stores/`) — routes never import `db` directly. The schema is a normalized model in `src/db/schema.ts`: `github_projects`, `commit_chunks` (per-commit diffs + pgvector embedding), `project_sync_state` (per-branch sync watermark), `reports`, `report_commits`, and `credentials`.

### No dependency injection

Services are imported at the top of files, not injected. Swapping implementations means changing import paths everywhere. Tests compensate with `vi.mock()`.

### No auth layer

The API has zero authentication. Fine for the MVP's trusted deployments. Impossible to open for multi-tenant SaaS without a full rework.

### Report generation (`src/reports/routes.ts`)

One ~160-line handler does validation, commit sync, chunk building, AI retry loop, and report persistence. Should be extracted into a service.

- Commit sync is `syncCommitsForProject()` (`src/projects/sync.ts`): paginated and unlimited (per_page is a page size; GitHub caps it at 100), runs inside a per-project `pg_advisory_xact_lock` transaction, dedupes against stored SHAs, and advances a per-`(project, branch)` watermark in `project_sync_state` (composite `(committed_at, commit_sha)` keyset, never regressing). The future ingestion pipeline reuses this same function with no window (catch-up from the watermark).
- Commit reads are store-first: `GET /api/v1/reports/:id/commits` serves stored rows from `report_commits` + `commit_chunks`; `POST /api/v1/reports` syncs the requested window via `syncCommitsForProject()`.

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
