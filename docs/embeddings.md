# Embeddings Strategy

How commit embeddings are produced, stored, and kept cheap and reliable. Semantic search over these vectors is the eventual goal; this document covers the foundation that already ships.

## Why this approach

Three constraints drove the design, in order of priority:

1. **Cost.** Embedding the full git diff for every commit would burn tokens on patch noise (boilerplate, formatting churn, generated files) for almost no retrieval value, and re-embedding unchanged content on every report run would multiply the bill. The corpus is therefore a *small-LLM summary of the real diff*, not the raw diff.
2. **Reliability.** Embedding must never block or fail report generation. If the embedding provider is down, out of quota, or missing a key, the report still succeeds — vectors are a derived cache that catches up later.
3. **Correctness by construction.** A commit is immutable (identified by its SHA), so a stored commit's content never changes. The only thing that can go stale is its embedding — and that staleness is tracked explicitly.

## The corpus: an LLM-verified summary of the diff

Each `commit_chunks` row stores a code-grounded summary plus structured metadata. The summary is produced by a **small LLM guardrail** (`src/repositories/summarizer.ts`) that reads the commit's real diff (from the local git archive) and verifies the change against its commit message — it never trusts the message verbatim. The bounded raw patch is saved in `diff_patch` for audit / future code search.

| Field | Source | Where stored |
|---|---|---|
| `sha` | local git log (isomorphic-git) | `commit_sha` |
| `commit_message` | local git log | `commit_message` |
| `author` | local git log | `author` |
| `diff_summary` | small-LLM summary of the diff (fallback: message + file stats) | `diff_summary` (embedding source) |
| `diff_patch` | bounded unified patch from the commit's tree walk | `diff_patch` |
| `files_changed` / `additions` / `deletions` | tree walk between commit and parent | `metadata` jsonb |
| `summary.model` / `summary.at` | summarizer model + run time | `metadata` jsonb |
| `validation.status` (`confirmed`/`flagged`/`skipped`) + `notes` | LLM verification result | `metadata` jsonb |
| `commit_url` | (legacy / optional) | `metadata` jsonb |

The embedded text is the `diff_summary` (the LLM's code-grounded summary). The raw patch is stored separately but not embedded.

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
- **Model:** the global AI setting `embeddingModel` (Settings → AI Settings, stored in `app_settings`), defaulting to `openai/text-embedding-3-small` (env `EMBEDDING_MODEL` fallback), 1536 dimensions — matches the pre-existing `vector(1536)` column and the HNSW index (`commit_embedding_hnsw_idx`, cosine). The Settings UI only offers 1536-dim OpenRouter embedding models.
- **Guarding:** if the model ever returns a vector of the wrong length, the batch fails loudly instead of writing corrupt vectors.
- **Model changes:** changing the embedding model only applies to newly embedded rows. Existing vectors keep their model until a full re-embed (the staleness gate is content-based, not model-based).

## The summarizer guardrail (`src/repositories/summarizer.ts`)

- **Batch:** commits are summarized in batches of `DIFF_SUMMARY_BATCH_SIZE` (default 50) per LLM call — the diff patches fit comfortably in a 256k-token context window.
- **Verification:** the model must confirm the diff matches its commit message and flag suspicious/empty/contradictory diffs; the result is stored as `validation.status` + `notes`.
- **Graceful degradation:** a missing key or a failed batch falls back to a structural summary (message + file stats, `validation.status = "flagged"` with a note). Ingestion never hard-fails on the guardrail.
- **Disabled:** set `DIFF_SUMMARY_ENABLED=false` to skip the LLM entirely (everything becomes structural fallbacks).

## When embeddings happen

1. **Inline, non-blocking** — after ingestion upserts new chunks, `embedNewChunks(projectId)` runs fire-and-forget (`void ... .catch(...)`). Report generation never waits on it or fails because of it. If it fails (no key, quota, outage), the chunks stay persisted with `content_hash`, and the next run or backfill catches up.
2. **Batch backfill** — `pnpm embed:backfill` (`backend/scripts/embed-backfill.ts`) walks every project and embeds all pending rows, in batches of `EMBEDDING_BATCH_SIZE` (default 100) — one HTTP call per batch.

## Reliability & scaling properties

- **Bounded cost per run:** diffs and summaries are only computed for SHAs not already in the store (`getChunksByShas` skips existing). Same-range re-runs make zero diff walks and zero summarizer/embedding calls.
- **Graceful degradation:** summarizer failures produce a valid, degraded doc (message + file stats) rather than poisoning a row; embedding failures leave the row pending for later.
- **Resumable:** every step is idempotent and can be re-run safely (dedupe by SHA).

## Status

- **Shipped:** archive-cloned diffs, LLM-verified summary corpus, staleness gate, inline non-blocking embed, batch backfill, OpenRouter provider wiring.
- **Not shipped (future):** the semantic-search endpoint (`cosineDistance` over the HNSW index), RAG prompt enrichment, and any retrieval consumer. See `docs/architecture.md` → "RAG (Vectors: partial, semantic search not shipped)".
