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
| P1-1 | **New model providers** | integrations | Registry (`providers/registry.ts`) + model catalog (`providers/catalog.ts`) now abstract four AI SDK protocols (`openai-chat`, `openai-responses`, `anthropic-messages`, `google-generative`), so Anthropic/Gemini/Groq/etc. is a registry entry, catalog entries, and an env key per `AGENTS.md`. Cheap, user-visible. |
| P1-3 | **RAG evaluation harness** | quality | No golden-set eval exists, so retrieval quality is unfalsifiable. Build before any retrieval change (P2-2) so improvements are measurable, not vibes. |
| P1-4 | **Reranking / hybrid scoring** | retrieval | Retrieval is vector + keyword fallback only. A rerank (or hybrid score fusion) stage is the single biggest lever on answer quality. Gated on P1-3. |

## P2 — Roadmap items (larger scope)

| ID | Item | Area | Why / notes |
|---|---|---|---|
| P2-2 | **Scheduled / webhook re-ingest** | ingestion | Ingestion is on-demand per chat, so "what did engineering do today?" depends on someone opening the app. A GitHub webhook or cron re-ingest is what makes the core promise actually true. |
| P2-3 | **Orphaned archive cleanup on delete** | storage | Deleting a project cascades in Postgres but orphans its S3 object / fs clone (`AGENTS.md:82`). Regenerable but silently leaks. Add a delete hook. |
| P2-4 | **Per-instance GitLab hosts** | integrations | `GITLAB_HOST` is a server-wide setting. Multi-tenant/self-hosted-per-project needs the host stored alongside the project/credential (the credentials table is keyed by provider only, so two instances would collide). |

## P3 — Deferred / strategic

| ID | Item | Area | Why / notes |
|---|---|---|---|
| P3-1 | **Transactions on ingest path** | db | Project-upsert and chunk-ingest are separate writes; a mid-way failure leaves chunks persisted (`architecture.md:156`). Safe today (chunks are the cache, and unembedded chunks are retried on the next ingest), fragile once auth/multi-tenant lands. |
| P3-2 | **Auth layer** | backend | Zero authentication (`architecture.md:147`). Fine for trusted self-hosted; blocks multi-tenant SaaS. Rework, not a patch. |
| P3-3 | **Persona-driven synthesis** | product | Custom tone mapping for CTOs/Founders/Board (`README.md:29`). |
| P3-4 | **External integrations** | product | Slack/Linear/Jira/Notion cross-referencing (`README.md:27`). Blocked behind an external-integration abstraction that doesn't exist yet. |
| P3-5 | **Enterprise security** | product | E2E encryption, SSO, org-level RBAC (`README.md:30`). |
| P3-6 | **Bounded pending embedding reads** | projects | `embedNewChunks` loads all pending chunks before batching; writes are set-based but the read is unbounded. Ingest now re-checks pending embeddings on every run, so a large persistent backlog is read on each re-ingest. Acceptable for current repo sizes; revisit for very large histories. See `architecture.md` → "Unbounded pending embedding reads". |

## Sequencing rationale

Eval harness + reranking → providers → next provider (GitLab landed; Bitbucket
would follow the same adapter pattern).
Product differentiators (personas, integrations) and auth stay deferred until
retrieval quality is measurable and the platform is multi-tenant-ready. See
`docs/architecture.md` ("Tech debt" / "What needs to happen") for the underlying
structural debt.

## Done — completed

| ID | Item | Area | Notes |
|---|---|---|---|
| P0-1 | **Request IDs + correlation** | backend | `genReqId` mints/echoes `x-request-id`; an `AsyncLocalStorage` request context (`@fastify/request-context`) exposes `reqId` to the shared logger for the whole request lifecycle. |
| P0-2 | **SSE error contract + heartbeat** | chat | `streamMessage` sends periodic heartbeat comments and a terminal `event: error` frame on mid-stream failure instead of leaving the client hanging. |
| P0-3 | **Validate `startDate`/`endDate`** | gitRepositories | TypeBox `format: "date-time"` on the discovery query so bad dates return 400. |
| P1-2 | **Embedding model-change invalidation** | projects | `commit_chunks` stores `embedding_provider`/`embedding_model`; pending and semantic-search gates require the current space plus `embedding_hash = content_hash`. Changing the embedding model enqueues a background reindex across projects; old-model vectors are never searched. |
| P2-1 | **GitLab adapter** | integrations | `GitlabAdapter` over a thin `fetch` client (`gitlab-client.ts`), `REGISTRY.gitlab` entry, provider-aware URLs/clone auth, `GITLAB_HOST` for self-hosted, and a frontend provider selector. `GET /api/v1/repositories` merges connected providers server-side, tags each row with `provider`, and the dialog shows provider icons + a compact connect panel. Demo ingestion stays GitHub-only and rejects other providers explicitly. |
| — | **Embedding resilience** | ingestion | Provider failures no longer fail an ingest: chunks are stored, the failure is logged, and retrieval falls back to keyword search. Every ingest re-checks pending embeddings, so a temporary outage self-heals on the next branch prepare; `pnpm embed:backfill` is the bulk path. |
