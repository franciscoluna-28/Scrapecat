# Embeddings

How commit rows are stored and embedded.

## Current status: no LLM summaries

LLM-generated summaries are **disabled for now**.

- `summary`, `summary_version`, and `summary_model` are nullable and are **not
  written**.
- The embedding text is `files_changed + message`.
- `commit-summary-service.ts` remains in the codebase for a later upgrade; the
  ingest path does not call it.
- The diff is still fetched, filtered, and hashed. No raw diff is stored.

The diff/summary pipeline is scaffolded, but the current read model is
message-based until a fast, trustworthy summary model is chosen.

## The document: one row per branch-commit

`commit_embeddings` stores one row per `(repo_id, branch, commit_sha)`:

| Field | Source |
|---|---|
| `message` | original git message (embedding text + display) |
| `files_changed` | `git diff --numstat` / GitHub commit API |
| `diff_hash` | SHA-256 of the cleaned, capped `stat + patch` |
| `summary` | nullable; not written while summaries are disabled |
| `summary_version` / `summary_model` | nullable; unused while disabled |
| `embedding` | vector(768) over `files_changed + message` |
| `embedding_provider` / `embedding_model` | vector-space identity |
| `content_hash` / `embedding_hash` | staleness gate |
| `search_vector` | tsvector (summary A when present, files B, message C) |

No raw diff is stored. Citations redirect to the provider commit.

### Why `search_vector` is a normal column

Postgres requires generated-column expressions to be immutable, and
`array_to_string(files_changed, ' ')` is stable, not immutable. The store writes
the vector in the same upsert as the file list and message, so there is one write
path and no trigger. Its GIN index backs the lexical channel that catches exact
paths, symbols, ticket IDs, and identifiers.

## Ingestion

```
diff → clean/cap → hash → embed files + message → upsert
```

- Diff: first parent, `--unified=3`, lockfiles/build/vendor/generated/minified
  excluded. Per-file and total caps keep the token budget bounded.
- Empty, merge, and binary-only diffs are skipped.
- No LLM call is made in the current build.
- Embedding failures never fail ingestion; the commit is stored without a vector
  and the reindex job catches up.
- A fatal embedding provider error (401/403/quota) disables embedding attempts
  for the rest of that ingest run.

## Staleness gate

A row's embedding is current iff:

1. `embedding_hash = content_hash`
2. `embedding_provider = current provider`
3. `embedding_model = current model`

`content_hash` is the hash of `commitEmbeddingText(files_changed, message)`.
Changing the embedding model enqueues `reindex-embeddings`, which rebuilds
vectors from the stored message and files without re-reading git.

## Dimensions and providers

- **768** is a database constraint shared by `vector(768)` and the HNSW index.
  `EMBEDDING_DIMENSIONS` in `src/shared/utils/embedding.ts` is the single source
  of truth.
- OpenRouter/OpenAI models are requested at 768 dims via the `dimensions`
  override; Ollama does not implement it, so its model must natively emit 768
  (`nomic-embed-text`).
- Every response is length-checked before it hits the column.

## When embeddings happen

1. **Inline during ingest** — per commit.
2. **Reindex job** — changing `embeddingProvider`/`embeddingModel` enqueues
   `reindex-embeddings`; it rebuilds pending vectors from stored messages.
3. **Backfill** — `pnpm embed:backfill` is the bulk reindex path.

## Later: re-enable summaries

When a fast, trustworthy summary model is available:

1. Generate the diff-grounded summary and write `summary`, `summary_version`,
   `summary_model`.
2. Switch the embedding text back to `files_changed + summary`.
3. Reuse summaries across branches for the same
   `(repo_id, commit_sha, diff_hash, summary_version, summary_model)`.
