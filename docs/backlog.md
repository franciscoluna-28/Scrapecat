# Backlog

Prioritized engineering backlog. Priority reflects sequencing (unblockers first),
not just value — see rationale per item.

- **P0** — foundation / unblockers. Do first; everything else is harder without them.
- **P1** — highest-value product work.
- **P2** — roadmap items, larger scope.
- **P3** — deferred / strategic, not yet justified.

## P0 — Foundation / unblockers

None open. P0-1–P0-4 are complete — see [Done](#done--completed).

## P1 — Highest-value product work

None open. P1-1–P1-5 are complete — see [Done](#done--completed).

## P2 — Roadmap items (larger scope)

| ID | Item | Area | Why / notes |
|---|---|---|---|
| P2-3 | **Project deletion** | storage | There is no project-delete route or store method today. Add `DELETE /api/v1/projects/:id`; `commit_chunks`, chat data, and `project_branches` already cascade in Postgres, and repo clones are ephemeral so nothing else needs cleaning up. |
| P2-5 | **Chat-session access guard refactor** | chat | Read/stream/delete repeat the session lookup + `canAccessSession` check (`backend/src/api/chat/routes.ts:56-107`). Add a `preHandler` + `req.chatSession` decorator so one lookup serves all session routes. Authorization behavior itself is already fixed by P2-5a. |
| P2-6 | **SSE reply plugin** | chat | `backend/src/api/chat/routes.ts:109-183` hand-rolls hijack, CORS reflection, SSE headers, heartbeat, and close cleanup. Extract `reply.sse.open/send/close()` so future streaming endpoints (e.g. ingest progress) share one implementation. |
| P2-7 | **Centralized error handling** | backend | Every handler try/catches → `console.error` → 500 across `chat`, `credentials`, `repositories`, `settings`, and `reports` routes. Introduce a typed `ApiError` mapped by the existing `setErrorHandler` (`backend/src/startup/create-server.ts:47-55`), log via the shared pino logger, and let handlers throw. |
| P2-8 | **Demo/write guards** | backend | `isDemoRestrictKeys` / `allowAddRepos` checks are repeated in `backend/src/api/credentials/routes.ts:20,33,54`, `backend/src/api/credentials/git-connection-routes.ts:18,53`, `backend/src/api/repositories/routes.ts:42`, and all seven handlers in `backend/src/api/reports/routes.ts:58,72,87,103,119,134,155`; `unsupportedInDemo` is at `backend/src/api/repositories/discovery.ts:67,132,191,235,310`. Extract `preHandler` guards applied in `backend/src/startup/register-routes.ts`. |
| P2-10 | **Remove GitLab provider support** | integrations | Poor adoption, and GitHub is the only provider the product needs while GitHub's native features keep improving. A second adapter costs a REST client, `GITLAB_TOKEN`/`GITLAB_HOST`, `git_provider`/`credential_provider` enum values, discovery fanout, clone/auth branches, and frontend provider selection/URL parsing. Remove it, then collapse the remaining git-provider registry/interface to GitHub-only. See `architecture.md` → Tech debt → "GitLab removal (planned)". P2-1 added the adapter; this item removes it. |

Frontend-specific debt (chat streaming/state, API error boundary, project
identity duplication, vendored UI, config drift, RSC boundary, test gaps) is
tracked in [`frontend-tech-debt.md`](./frontend-tech-debt.md).

## P3 — Deferred / strategic

| ID | Item | Area | Why / notes |
|---|---|---|---|
| P3-1 | **Transactions on ingest path** | db | Project-upsert and chunk-ingest are separate writes; a mid-way failure leaves chunks persisted (`architecture.md` → "Validation & data-integrity gaps"). Safe today (chunks are the cache, and unembedded chunks are retried on the next ingest), fragile once auth/multi-tenant lands. |
| P3-2 | **Multi-tenant auth layer** | backend | No end-user accounts by design for the open-source self-hosted model (one trusted operator). Request-level authorization already exists: chat sessions are scoped by `x-anonymous-id`, and demo mode restricts keys, repo writes, and rate limits. What's missing is identity/tenancy — accounts, per-user isolation, SSO — which blocks hosted multi-tenant SaaS. Rework, not a patch. |
| P3-4 | **External integrations** | product | Slack/Linear/Jira/Notion cross-referencing (`README.md:33`). Blocked behind an external-integration abstraction that doesn't exist yet. |
| P3-5 | **Enterprise security** | product | E2E encryption, SSO, org-level RBAC (`README.md:34`). |
| P3-6 | **Bounded pending embedding reads** | projects | `embedNewChunks` loads all pending chunks before batching (`listPendingChunks(projectId, space)`); writes are set-based but the read is unbounded. Ingest re-checks pending embeddings on every run, so a large persistent backlog is read on each re-ingest. Acceptable for current repo sizes; revisit for very large histories. See `architecture.md` → "Unbounded pending embedding reads". |
| P3-9 | **Persistent repo clone cache** | ingestion | Deferred. The clone is ephemeral (`os.tmpdir()`) and Postgres is the durable read model; `git ls-remote` + `project_branches` skip unchanged branches, and blobless clones keep moved-branch downloads to commits/trees. If measured clone time dominates ingest, add a self-healing per-`provider/owner/repo` cache (shared object store across branches, incremental `git fetch`, no distributed cache). See `architecture.md` → "Why no persistent clone cache". |


## Production scale

Known limits that only bite past a single trusted deployment:

| Gap | Why it blocks scale | Item |
|---|---|---|
| **No multi-tenant identity** | Intentional for open-source self-hosted; chat sessions and demo writes are already authorization-scoped, but there is no account/tenant isolation | P3-2 |
| **Single-process worker** | Jobs are durable in Postgres, but the default worker runs in one process; horizontal scaling needs stale-lock recovery instead of fail-on-boot | — |
| **No project delete** | Projects can only be removed manually, so rows accumulate in Postgres | P2-3 |
| **Unbounded pending-embedding reads** | Memory scales with the whole backlog, not the batch size | P3-6 |
| **No ingest transactions** | Partial writes become unsafe once ingests run concurrently across tenants | P3-1 |

## Sequencing rationale

**Stability comes before feature work.** CI, bounded provider calls, graceful
shutdown, readiness, and UI error boundaries are prerequisites for asking anyone
to run the tool. Production images are available for self-hosted clients (P3-7);
the serverless Vercel path is unchanged.

Hybrid retrieval (P1-4) and in-app daily/weekly summaries (P1-5) have landed, so
the next product work is the GitHub-only cleanup (P2-10) and project
deletion (P2-3). Scheduled re-ingest is covered by report runs
(P2-2), so a webhook or separate refresh worker is not planned.

Provider expansion is deferred; GitLab is being removed (P2-10) so the product
stays GitHub-only. External integrations and auth stay deferred until retrieval
quality is measurable and the platform is multi-tenant-ready. See
`docs/architecture.md` ("Tech debt" / "What needs to happen") for the underlying
structural debt.

The Fastify refactors (P2-5–P2-8) are independent and can land between product
items. P2-6 is a good first follow-up: it is self-contained and reusable for
future streaming endpoints. P2-7 is the broadest cleanup, P2-8 is a
narrow guard extraction, and P2-5 is now only a dedupe refactor because its
authorization half (P2-5a) already landed.

## Done — completed

| ID | Item | Area | Notes |
|---|---|---|---|
| S-1 | **CI pipeline** | tooling | GitHub Actions runs frozen install, typecheck, lint, unit tests, and build; a second job migrates an empty pgvector database and runs the integration suite. Root `check` mirrors the typecheck/lint/test gates locally; CI also builds. |
| S-3 | **Graceful shutdown** | backend | `SIGTERM`/`SIGINT` stop the job worker and wait for the current job before closing; jobs interrupted by a hard crash are failed on the next boot so callers do not wait forever. |
| P3-8 | **Durable job queue** | backend | Ingestion and reindexing run as deduped Postgres `jobs` rows claimed with `FOR UPDATE SKIP LOCKED` by an in-process worker; no Redis/RabbitMQ. Progress survives restarts via the `progress` column, and the unique active idempotency key dedupes concurrent callers. Set `WORKER_ENABLED=false` for API-only replicas. |
| S-4 | **Bounded provider calls** | ai | `AI_TIMEOUT_MS` bounds chat and embedding requests; embeddings retry once; SSE aborts upstream work when the client disconnects. |
| S-5 | **Readiness probe** | backend | `GET /api/v1/health/ready` checks Postgres and returns 503 on failure; liveness stays on `/health`. |
| S-6 | **UI error boundaries** | frontend | Root `error.tsx` and `global-error.tsx` show a retry surface instead of a blank screen. |
| S-7 | **Startup config validation** | backend | `ENCRYPTION_KEY` must be base64-encoded 32 bytes at boot, not at first encrypt. |
| P1-3 | **RAG evaluation harness** | quality | Golden datasets (`backend/eval/datasets/`) score the real retriever with context recall, rank-aware context precision, MRR, and negative-result accuracy (21 cases, 8 negatives). `pnpm eval` runs one on demand; pure metric/dataset tests run in CI. Baselines and labeling rules live in `docs/evaluation.md`. |
| P1-4 | **Hybrid retrieval (RRF)** | retrieval | Semantic and lexical channels run in parallel and are fused with reciprocal rank fusion (`backend/src/rag/retrieval/fusion.ts`, `retrieve.ts`). Temporal summary mode, query-token corroboration, and deterministic abstention handle date windows and weak evidence. No dedicated cross-encoder reranker was needed; quality is measured by P1-3. |
| P1-5 | **In-app daily summaries** | product | Full `reports` domain: `report_schedules` and `reports` tables, a poller that claims durable schedules, refreshes the branch through `prepareProjectBranch`, reads commits since the last success, generates a cited summary, and stores it. The frontend Reports dashboard supports daily/weekly schedules, run-now, edit, delete, and report detail. V1 is one schedule per project+branch; custom cron, multi-repo selection, and delivery are future work. |
| P1-1 | **New model providers** | integrations | The provider registry now covers OpenRouter, DeepSeek, OpenAI, Groq, OpenCode Go, and local Ollama, with protocol-aware routing in `catalog.ts`/`protocols.ts`. Credential verification is registry-driven (`verifyUrl`), and Ollama resolves through `OLLAMA_BASE_URL`. Adding a provider remains a registry entry, catalog entries, an env key, and an enum value. |
| P0-1 | **Request IDs + correlation** | backend | `genReqId` mints/echoes `x-request-id`; an `AsyncLocalStorage` request context (`@fastify/request-context`) exposes `reqId` to the shared logger for the whole request lifecycle. |
| P0-2 | **SSE error contract + heartbeat** | chat | `streamMessage` sends periodic heartbeat comments and a terminal `event: error` frame on mid-stream failure instead of leaving the client hanging. |
| P0-3 | **Validate `startDate`/`endDate`** | gitRepositories | TypeBox `format: "date"` on the discovery query so bad dates return 400. |
| P0-4 | **Chat-turn idempotency** | chat | `chat_messages.client_message_id` + partial unique index `(session_id, role, client_message_id)`; `ON CONFLICT DO NOTHING` dedupes retried sends and replays a completed turn. The frontend generates one id per logical send. Projects/credentials/git connections already upsert on natural keys, so no generic layer was needed. The original `idempotency_keys` table, hashing, locks, TTLs, replay responses, and header contract were overengineering for this app; only the extreme case — duplicate user chat turns — is handled. |
| P1-2 | **Embedding model-change invalidation** | projects | `commit_chunks` stores `embedding_provider`/`embedding_model`; pending and semantic-search gates require the current space plus `embedding_hash = content_hash`. Changing the embedding model enqueues a background reindex across projects; old-model vectors are never searched. |
| P2-1 | **GitLab adapter** | integrations | `GitlabAdapter` over a thin `fetch` client (`gitlab-client.ts`), `REGISTRY.gitlab` entry, provider-aware URLs/clone auth, `GITLAB_HOST` for self-hosted, and a frontend provider selector. `GET /api/v1/repositories` merges connected providers server-side, tags each row with `provider`, and the dialog shows provider icons + a compact connect panel. Demo ingestion stays GitHub-only and rejects other providers explicitly. |
| P2-2 | **Scheduled re-ingest** | ingestion | Scheduled report runs refresh their project branch through `prepareProjectBranch` before reading the period's commits, so self-hosted clones stay current and demo mode serves stored rows. No webhook or separate refresh worker is planned; report schedules cover the daily-summary path. |
| P2-5a | **Chat-session ownership enforcement** | chat | Read, stream, and delete return 404 for a session owned by another anonymous id; the header is trimmed/capped and input is bounded. Landed in `cf3c6fd` and re-hardened in `96236fe`. |
| P2-9 | **Credential provider body validation** | backend | `CredentialProviderSchema` derives its literals from `PROVIDER_REGISTRY` and validates `AddCredentialBody`/`VerifyCredentialBody` at the route boundary; the service check remains as defense in depth. Unsupported providers now return 400. |
| P2-9a | **Git provider param validation** | backend | `GitProviderParams` already enforces the `GitProviderSchema` union (`github`/`gitlab`), so the redundant `unimplementedProvider` guard was removed from the connection handlers. |
| P3-3 | **Persona-driven synthesis** | product | Per-conversation `persona` (`founder` / `cto` / `engineer`) flows from `ChatComposer` through `useAIChat` and the chat API into `buildSystemPrompt`, which maps each persona to audience-specific tone rules. Frontend and backend persona lists are kept in sync. |
| P3-7 | **Production Docker images** | deployment | Workspace-aware `backend/Dockerfile` and `frontend/Dockerfile`, plus `docker-compose.prod.yml`. Backend bundles `main` and the migration runner with esbuild, installs prod deps only, ships native git, runs as non-root, healthchecks readiness, and migrates on boot. Frontend builds a Docker-only Next standalone bundle (guarded by `NEXT_OUTPUT`, so Vercel is unchanged) and runs `server.js` as non-root. See `docs/deployment.md`. |
| — | **Embedding resilience** | ingestion | Provider failures no longer fail an ingest: chunks are stored, the failure is logged, and retrieval falls back to lexical search. Every ingest re-checks pending embeddings, so a temporary outage self-heals on the next branch prepare; `pnpm embed:backfill` is the bulk path. |
