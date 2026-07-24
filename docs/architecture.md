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
│     SQLite (MVP) ──[future]──── SurrealDB               │
│     Drizzle ORM · libSQL client                         │
│     R2 (S3-compatible image storage)                    │
│     Octokit (GitHub REST API)                           │
│     ──[future]──── GitLab · Bitbucket                   │
└─────────────────────────────────────────────────────────┘
```

## Tech Debt

The MVP solved one concrete problem as fast as possible. Every shortcut was intentional but now needs addressing.

### Git provider coupling

All external data flows through `src/shared/github.ts` — a single Octokit instance imported directly by every route handler. Adding GitLab or Bitbucket means touching every route. No adapter, no interface.

### Database coupling

The DB client is initialized at module load in `src/db/client.ts` and imported directly by every route that persists data. No repository layer, no interface. Changing the engine means rewriting every route that touches `db`. The schema is a single `reports` table — no room for the richer data model the product needs.

### No dependency injection

Services are imported at the top of files, not injected. Swapping implementations means changing import paths everywhere. Tests compensate with `vi.mock()`.

### No auth layer

The API has zero authentication. Fine for the MVP's trusted deployments. Impossible to open for multi-tenant SaaS without a full rework.

## What needs to happen

Decouple in three phases, no big-bang rewrites:

1. **Git provider interface** — extract an adapter behind a single interface so routes don't know or care whether data comes from GitHub, GitLab, or Bitbucket
2. **Data access layer** — extract a store interface so the engine can switch from SQLite to SurrealDB (needed for graph traversals, vector search, and the connected data model the product requires)
3. **Dependency injection** — wire providers and stores into the app via Fastify's decorate mechanism so routes receive their dependencies instead of importing them

Each migration follows the same pattern: extract interface, write new implementation behind it, run both in parallel, flip the default, remove the old one.
