# Embeddings Strategy

How commit embeddings are produced, stored, and kept cheap and reliable. Semantic search over these vectors is the eventual goal; this document covers the foundation that already ships.

## Why this approach

Three constraints drove the design, in order of priority:

1. **Cost.** Embedding the full git diff for every commit would burn tokens on patch noise (boilerplate, formatting churn, generated files) for almost no retrieval value, and re-embedding unchanged content on every report run would multiply the bill. The corpus is therefore a *structured commit doc*, not a diff.
2. **Reliability.** Embedding must never block or fail report generation. If the embedding provider is down, out of quota, or missing a key, the report still succeeds — vectors are a derived cache that catches up later.
3. **Correctness by construction.** A commit is immutable (identified by its SHA), so a stored commit's content never changes. The only thing that can go stale is its embedding — and that staleness is tracked explicitly.

## The corpus: a structured commit doc

Each `commit_chunks` row stores a compact, human-readable doc plus structured metadata. Full patch text is **never** stored or embedded.

| Field | Source | Where stored |
|---|---|---|
| `sha` | `listCommits` | `commit_sha` |
| `commit_message` | `listCommits` | `commit_message` |
| `author` | `listCommits` | `author` |
| `summary` | PR body excerpt, falling back to the commit message | `diff_summary` (embedding source) |
| `pr_title` / `pr_url` / `pr_number` | `getPullRequestForCommit` | `metadata` jsonb |
| `files_changed` | `getCommitDetails` → `files[].filename` | `metadata` jsonb |
| `metrics` (`added`/`deleted`) | `getCommitDetails` → `stats` | `metadata` jsonb |
| `commit_url` | `listCommits` → `html_url` | `metadata` jsonb |

The embedded text is the composed doc (`summary` + PR title + commit message). Diffs are never part of the embedding.

## The staleness gate: `content_hash` / `embedding_hash`

Two SHA-256 columns on `commit_chunks` make embedding idempotent and incremental:

- `content_hash` — hash of the stored `diff_summary`. Set on every upsert.
- `embedding_hash` — hash of the content the current `embedding` represents. `NULL` = never embedded.

A row's embedding is **current** iff `embedding_hash = content_hash`. The embed job only processes rows where that is false (`embedding_hash IS NULL OR embedding_hash <> content_hash`), so:

- Re-running over already-stored commits embeds **nothing** (zero cost).
- If a row's content ever changes, its `content_hash` differs and it is re-embedded exactly once.
- Legacy rows with a `NULL` `content_hash` are normalized on first embed (both hashes are backfilled from the `diff_summary`).

## Provider and dimensions

- **Provider:** OpenRouter's OpenAI-compatible embeddings endpoint (`https://openrouter.ai/api/v1/embeddings`), reusing the existing OpenRouter API key (`resolveApiKey("openrouter")` → `OPENROUTER_API_KEY`).
- **Model:** `openai/text-embedding-3-small` (env `EMBEDDING_MODEL`), 1536 dimensions — matches the pre-existing `vector(1536)` column and the HNSW index (`commit_embedding_hnsw_idx`, cosine).
- **Guarding:** if the model ever returns a vector of the wrong length, the batch fails loudly instead of writing corrupt vectors.

## When embeddings happen

1. **Inline, non-blocking** — after a report generation upserts new chunks, `embedNewChunks(projectId)` runs fire-and-forget (`void ... .catch(...)`). Report generation never waits on it or fails because of it. If it fails (no key, quota, outage), the chunks stay persisted with `content_hash`, and the next run or backfill catches up.
2. **Batch backfill** — `pnpm embed:backfill` (`backend/scripts/embed-backfill.ts`) walks every project and embeds all pending rows, in batches of `EMBEDDING_BATCH_SIZE` (default 100) — one HTTP call per batch.

## Reliability & scaling properties

- **Bounded cost per run:** GitHub enrichment (PR + per-commit detail) only runs for SHAs not already in the store (`getChunksByShas`); the enrich calls are concurrency-limited (6). Same-range re-runs make zero enrichment calls and zero embedding calls.
- **Graceful degradation:** enrichment failures produce a valid, degraded doc (message + author + URL) rather than poisoning a row; embedding failures leave the row pending for later.
- **Resumable:** every step is idempotent and can be re-run safely.

## Retrieval (experimental)

`POST /api/v1/chat/ask` answers natural-language questions over a project's indexed commits:

1. The question is embedded with the same model (`openai/text-embedding-3-small`, 1536 dims).
2. `searchChunks()` (`src/projects/retrieval.ts`) runs a cosine query (`<=>` distance, ascending) over `commit_chunks.embedding` using the HNSW index, filtered to the project and rows with a non-null embedding.
3. Temporal constraints are extracted from the question (`extractDateFilter` in `src/chat/date-filter.ts` — months/years, "since/before/between", "last N days", "this year", etc.) and applied as a `committed_at` range so "what was built in august 2026" only retrieves commits dated in August 2026. Dates are also included in the LLM context (`buildAskPrompt`), so the model can reason about *when* and cite dates.
4. Only hits above a similarity threshold (`MIN_SIMILARITY`, currently 0.3) are surfaced. If nothing qualifies — or the project has no chunks / no embeddings — the endpoint returns a deterministic refusal message instead of calling the LLM, so it never fabricates an answer from an empty or mismatched corpus.

The retrieved commits are returned alongside the answer as `sources` (sha, author, date, message, similarity) so answers can be verified.

## Status

- **Shipped:** commit-doc corpus, deduped enrichment, staleness gate, inline non-blocking embed, batch backfill, OpenRouter provider wiring, experimental semantic-search + RAG answer endpoint (`POST /api/v1/chat/ask`) with temporal filtering, similarity threshold, and no-evidence refusal.
- **Not shipped (future):** a dedicated ingestion route/pipeline. Today the corpus is populated only as a side effect of report generation (`createReportUseCase` → `syncProjectCommits`, capped at `MAX_LIMIT=100` per window), so a project with no report has no indexed commits. There is no cold-start full backfill, no watermark-based incremental sync, and no empty-repo handling. This is tracked as technical debt in `docs/architecture.md` — see "RAG ingestion (not shipped)".
