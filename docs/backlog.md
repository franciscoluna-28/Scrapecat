# Backlog

Prioritized engineering backlog. Priority reflects sequencing (unblockers first),
not just value — see rationale per item.

- **P0** — foundation / unblockers. Do first; everything else is harder without them.
- **P1** — highest-value product work.
- **P2** — roadmap items, larger scope.
- **P3** — deferred / strategic, not yet justified.

## P0 — Foundation / unblockers

All P0 items are complete — see [Done](#done--completed).

## P1 — Highest-value product work

| ID | Item | Area | Why / notes |
|---|---|---|---|
| P1-3 | **RAG evaluation harness** | quality | No golden-set eval exists, so retrieval quality is unfalsifiable. Build before any retrieval change (P2-2) so improvements are measurable, not vibes. |
| P1-4 | **Reranking / hybrid scoring** | retrieval | Retrieval is vector + keyword fallback only. A rerank (or hybrid score fusion) stage is the single biggest lever on answer quality. Gated on P1-3. |

## P2 — Roadmap items (larger scope)

| ID | Item | Area | Why / notes |
|---|---|---|---|
| P2-2 | **Scheduled / webhook re-ingest** | ingestion | Ingestion is on-demand per chat, so "what did engineering do today?" depends on someone opening the app. A GitHub webhook or cron re-ingest is what makes the core promise actually true. |
| P2-3 | **Orphaned archive cleanup on delete** | storage | Deleting a project cascades in Postgres but orphans its S3 object / fs clone (`AGENTS.md:82`). Regenerable but silently leaks. Add a delete hook. |
| P2-4 | **Per-instance GitLab hosts** | integrations | `GITLAB_HOST` is a server-wide setting. Multi-tenant/self-hosted-per-project needs the host stored alongside the project/credential (the credentials table is keyed by provider only, so two instances would collide). |

### Engineering hygiene / refactors

| ID | Item | Area | Why / notes |
|---|---|---|---|
| P2-5 | **Chat-session ownership guard** | chat | Session load + `anonymousId` check is duplicated in `chat/routes.ts:69-75,97-103`, and `getMessages` (`51-63`) skips it. Add a `preHandler` + `req.chatSession` decorator: one lookup, 404/403 in one place, and read/delete/stream agree on access. |
| P2-6 | **SSE reply plugin** | chat | `chat/routes.ts:105-148` hand-rolls hijack, CORS reflection, SSE headers, heartbeat, and close cleanup. Extract `reply.sse.open/send/close()` so future streaming endpoints (e.g. ingest progress) share one implementation. |
| P2-7 | **Centralized error handling** | backend | Every handler try/catches → `console.error` → 500 (`projects`, `gitRepositories`, `credentials`, `settings`, `gitConnections`, `chat` routes). Introduce a typed `ApiError` mapped by the existing `setErrorHandler` (`create-server.ts:47`), log via the shared pino logger, and let handlers throw. |
| P2-8 | **Demo/write guards** | backend | `isDemoRestrictKeys` / `allowAddRepos` checks are repeated in `credentials/routes.ts:19-20,33-35,54-56`, `gitConnections/routes.ts:31-35,72-76`, and `projects/routes.ts:58-60`; `unsupportedInDemo` is at `gitRepositories/routes.ts:44-49`. Extract `preHandler` guards applied in `register-routes.ts`. |
| P2-9 | **Provider-param guard** | backend | `unimplementedProvider` is re-applied in each `gitConnections` handler (`18-25,40,57,80`) and credential providers are validated inside services. Validate `:provider` once via a `preHandler` / TypeBox union. |

## P3 — Deferred / strategic

| ID | Item | Area | Why / notes |
|---|---|---|---|
| P3-1 | **Transactions on ingest path** | db | Project-upsert and chunk-ingest are separate writes; a mid-way failure leaves chunks persisted (`architecture.md:156`). Safe today (chunks are the cache, and unembedded chunks are retried on the next ingest), fragile once auth/multi-tenant lands. |
| P3-2 | **Auth layer** | backend | Zero authentication (`architecture.md:147`). Fine for trusted self-hosted; blocks multi-tenant SaaS. Rework, not a patch. |
| P3-4 | **External integrations** | product | Slack/Linear/Jira/Notion cross-referencing (`README.md:27`). Blocked behind an external-integration abstraction that doesn't exist yet. |
| P3-5 | **Enterprise security** | product | E2E encryption, SSO, org-level RBAC (`README.md:30`). |
| P3-6 | **Bounded pending embedding reads** | projects | `embedNewChunks` loads all pending chunks before batching; writes are set-based but the read is unbounded. Ingest now re-checks pending embeddings on every run, so a large persistent backlog is read on each re-ingest. Acceptable for current repo sizes; revisit for very large histories. See `architecture.md` → "Unbounded pending embedding reads". |

## Sequencing rationale

Eval harness + reranking → providers → next provider (GitLab landed; Bitbucket
would follow the same adapter pattern).
External integrations and auth stay deferred until retrieval quality is
measurable and the platform is multi-tenant-ready. See `docs/architecture.md`
("Tech debt" / "What needs to happen") for the underlying structural debt.

The Fastify refactors (P2-5–P2-9) are independent and can land between product
items; P2-5 should be first because it also aligns chat read authorization with
delete/stream.

## Done — completed

| ID | Item | Area | Notes |
|---|---|---|---|
| P1-1 | **New model providers** | integrations | Added Groq as the first new provider (OpenAI-compatible, Bearer auth): registry + catalog entry, `GROQ_API_KEY`, `credential_provider` enum value, and frontend provider constant. Settings schema unions and the models aggregation now derive from the registry, so the next provider is a registry entry, catalog entries, an env key, and an enum value. Anthropic/Gemini still need provider-aware credential verification (`x-api-key` / `?key=`). |
| P0-1 | **Request IDs + correlation** | backend | `genReqId` mints/echoes `x-request-id`; an `AsyncLocalStorage` request context (`@fastify/request-context`) exposes `reqId` to the shared logger for the whole request lifecycle. |
| P0-2 | **SSE error contract + heartbeat** | chat | `streamMessage` sends periodic heartbeat comments and a terminal `event: error` frame on mid-stream failure instead of leaving the client hanging. |
| P0-3 | **Validate `startDate`/`endDate`** | gitRepositories | TypeBox `format: "date-time"` on the discovery query so bad dates return 400. |
| P1-2 | **Embedding model-change invalidation** | projects | `commit_chunks` stores `embedding_provider`/`embedding_model`; pending and semantic-search gates require the current space plus `embedding_hash = content_hash`. Changing the embedding model enqueues a background reindex across projects; old-model vectors are never searched. |
| P2-1 | **GitLab adapter** | integrations | `GitlabAdapter` over a thin `fetch` client (`gitlab-client.ts`), `REGISTRY.gitlab` entry, provider-aware URLs/clone auth, `GITLAB_HOST` for self-hosted, and a frontend provider selector. `GET /api/v1/repositories` merges connected providers server-side, tags each row with `provider`, and the dialog shows provider icons + a compact connect panel. Demo ingestion stays GitHub-only and rejects other providers explicitly. |
| P3-3 | **Persona-driven synthesis** | product | Per-conversation `persona` (`founder` / `cto` / `engineer`) flows from `ChatComposer` through `useAIChat` and the chat API into `buildSystemPrompt`, which maps each persona to audience-specific tone rules. Frontend and backend persona lists are kept in sync. |
| — | **Embedding resilience** | ingestion | Provider failures no longer fail an ingest: chunks are stored, the failure is logged, and retrieval falls back to keyword search. Every ingest re-checks pending embeddings, so a temporary outage self-heals on the next branch prepare; `pnpm embed:backfill` is the bulk path. |
