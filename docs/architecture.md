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
│     Store layer in src/db/stores/                        │
│     R2 (S3-compatible image storage)                     │
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

All external data flows through `src/shared/github.ts` — a single Octokit instance imported directly by every route handler. Adding GitLab or Bitbucket means touching every route. No adapter, no interface.

### Database coupling

The DB client is initialized at module load in `src/db/client.ts`. Access goes through the store layer in `src/db/stores/` (`projects-store`, `commit-chunks-store`, `reports-store`, `credentials-store`) — routes never import `db` directly. The schema is a normalized model: `github_projects`, `commit_chunks` (per-commit diffs + pgvector embedding), `reports`, and `credentials`.

### No dependency injection

Services are imported at the top of files, not injected. Swapping implementations means changing import paths everywhere. Tests compensate with `vi.mock()`.

### No auth layer

The API has zero authentication. Fine for the MVP's trusted deployments. Impossible to open for multi-tenant SaaS without a full rework.

### Report generation (`src/routes/generate-report.ts`)

One ~160-line handler does validation, GitHub fetch, chunk building, AI retry loop, and report persistence. Should be extracted into a service.

- The PR deep-search + R2 image pipeline (`src/services/r2.ts`, `extractImagesFromPrBody`) is deprecated from the report path. Both files remain in the tree but are unwired.
- `quickMode` is a no-op — the frontend still sends it, the backend ignores it.
- Per-commit PR/detail enrichment (`getPullRequestForCommit`, `getCommitDetails`) only runs for SHAs not already stored, concurrency-limited to 6, and degrades gracefully on failure.
- Legacy reports with a `## Media` section silently lose it during refinement (`src/routes/reply.ts` strips it).

### Validation & data-integrity gaps

- `startDate`/`endDate` are unvalidated strings; invalid dates surface as generic 500s.
- `limit` in `GET /repositories/:owner/:repo/commits` is `parseInt`-ed without validation (NaN can propagate to GitHub).
- `GET /repositories/*`, `/commits`, `/commits/count` hit GitHub live instead of the commit store — discovery endpoints, not the normalized read path.
- No transactions: project upsert, chunk upsert, and report create are separate writes. A mid-way failure leaves chunks persisted without a report (safe today — chunks are the cache — but should be intentional).

## What needs to happen

Decouple in three phases, no big-bang rewrites:

1. **Git provider interface** — extract an adapter behind a single interface so routes don't know or care whether data comes from GitHub, GitLab, or Bitbucket
2. **Data access layer** — store layer extracted into `src/db/stores/`; Postgres + pgvector provides the connected data model. The vector-search half of this (HNSW on `commit_chunks.embedding`) is infrastructure-ready but **WIP** — embeddings are populated, the `cosineDistance` search endpoint is not — see "RAG (Vectors: partial, semantic search not shipped)" above
3. **Dependency injection** — wire providers and stores into the app via Fastify's decorate mechanism so routes receive their dependencies instead of importing them

Each migration follows the same pattern: extract interface, write new implementation behind it, run both in parallel, flip the default, remove the old one.
