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
2. **Data access layer** — store layer extracted into `src/db/stores/`; Postgres + pgvector already provides the graph traversals and vector search (HNSW on `commit_chunks.embedding`) the connected data model requires
3. **Dependency injection** — wire providers and stores into the app via Fastify's decorate mechanism so routes receive their dependencies instead of importing them

Each migration follows the same pattern: extract interface, write new implementation behind it, run both in parallel, flip the default, remove the old one.
