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

## RAG (Work in Progress)

Semantic search over engineering history is **not shipped yet**. The infrastructure is ready but the pipeline is not wired:

- `commit_chunks.diff_summary` is populated at ingest time from per-commit diffs — the RAG corpus already exists.
- `commit_chunks.embedding` (`vector(1536)`) and the HNSW index (`commit_embedding_hnsw_idx`) are in place but **every embedding is NULL** — no embedding provider or backfill job exists yet.
- There is no semantic-search endpoint (`cosineDistance` over the HNSW index is the planned path).

Until a RAG phase ships, the `embedding` column stays empty and commit discovery relies on the `(project_id, commit_sha)` unique index and date-range queries.

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

## What needs to happen

Decouple in three phases, no big-bang rewrites:

1. **Git provider interface** — extract an adapter behind a single interface so routes don't know or care whether data comes from GitHub, GitLab, or Bitbucket
2. **Data access layer** — store layer extracted into `src/db/stores/`; Postgres + pgvector provides the connected data model. The vector-search half of this (HNSW on `commit_chunks.embedding`) is infrastructure-ready but **WIP** — see "RAG (Work in Progress)" above
3. **Dependency injection** — wire providers and stores into the app via Fastify's decorate mechanism so routes receive their dependencies instead of importing them

Each migration follows the same pattern: extract interface, write new implementation behind it, run both in parallel, flip the default, remove the old one.
