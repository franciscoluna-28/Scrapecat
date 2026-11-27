# Embeddings

How commit documents are produced, stored, and kept cheap. Semantic search over
these vectors backs RAG retrieval.

## Why this approach

1. **The diff is the source of truth.** Commit messages are inconsistent, vague,
   or wrong. The retrieval document is a short summary generated from the actual
   diff, not the message.
2. **Relational first, vector as an index.** Facts live in Postgres columns and
   arrays; the vector is one indexed column, not the schema.
3. **Embedding never blocks retrieval.** If the provider is down, the row keeps
   its summary and the lexical channel still works; the reindex job catches up.

## The document: one row per branch-commit

`commit_embeddings` stores one row per `(repo_id, branch, commit_sha)`:

| Field | Source |
|---|---|
| `message` | original git message (display + low-weight lexical) |
| `summary` | LLM-generated, diff-grounded description |
| `files_changed` | `git diff --numstat` / GitHub commit API |
| `diff_hash` | SHA-256 of the cleaned, capped `stat + patch` |
| `summary_version` / `summary_model` | prompt/model identity |
| `embedding` | vector(768) over `files_changed + summary` |
| `embedding_provider` / `embedding_model` | vector-space identity |
| `content_hash` / `embedding_hash` | staleness gate |
| `search_vector` | tsvector (summary A, files B, message C), written by the store |

No raw diff is stored. The row stores the summary, file list, hashes, and
`commit_url`; the UI redirects to the provider commit for the code.

### Why `search_vector` is a normal column

`search_vector` is Postgres full-text search over the summary (weight A), file
paths (B), and the original message (C), with a GIN index. It powers the lexical
channel, which catches exact paths, symbols, ticket IDs, and identifiers that
embeddings miss.

It is **not** a generated column: Postgres requires generated expressions to be
immutable, and `array_to_string(files_changed, ' ')` is stable, not immutable.
The store writes the vector in the same upsert as the summary and file list, so
there is one write path and no trigger.

## Ingestion

```
diff → clean/cap → hash → (reuse | summarize) → embed → upsert
```

- Diff: first parent, `--unified=3`, lockfiles/build/vendor/generated/minified
  excluded. Per-file and total caps keep the token budget bounded.
- Message gate: the rule guardrail decides whether the message is trustworthy.
  A flagged message is omitted from the summary prompt entirely; the diff wins.
- Summary: one LLM call, 3–4 sentences. If the model fails, a structural
  file/stat fallback is stored.
- Reuse: an existing row with the same `(repo_id, commit_sha, diff_hash,
  summary_version, summary_model)` on another branch is copied instead of
  calling the model again.
- Embedding: `files_changed` (capped to 30 unique paths) + `summary`, one call,
  768 dims.

## Staleness gate

A row's embedding is current iff:

1. `embedding_hash = content_hash`
2. `embedding_provider = current provider`
3. `embedding_model = current model`

`summary_version` / `summary_model` decide whether the summary itself is
current. Changing the prompt bumps the version; changing the embedding model
enqueues `reindex-embeddings`, which re-embeds from the stored summaries without
re-reading git.

## Dimensions and providers

- **768** is a database constraint shared by `vector(768)` and the HNSW index.
  `EMBEDDING_DIMENSIONS` in `src/shared/utils/embedding.ts` is the single source
  of truth.
- OpenRouter/OpenAI models are requested at 768 dims via the `dimensions`
  override; Ollama does not implement it, so its model must natively emit 768
  (`nomic-embed-text`).
- Every response is length-checked before it hits the column.

## When embeddings happen

1. **Inline during ingest** — per commit, right after the summary.
2. **Reindex job** — changing `embeddingProvider`/`embeddingModel` enqueues
   `reindex-embeddings`; it resolves the new space once and updates pending rows
   from stored summaries. A failure in one project is logged and does not stop
   the others.
3. **Backfill** — `pnpm embed:backfill` is the bulk reindex path.

## Status

- **Shipped:** diff-grounded summaries, source diffs from native git and GitHub
  API patches, message gate, cross-branch reuse, 768-dim vectors, reindex job,
  HNSW + GIN indexes.
- **Deliberately not stored:** raw diffs. Citations redirect to the commit.
