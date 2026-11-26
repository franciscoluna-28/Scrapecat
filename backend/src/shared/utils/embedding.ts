/**
 * Domain-specific embedding helpers for commit documents.
 *
 * Kept here rather than in a store/service so the same text/hash rules are
 * reused by ingestion and reindexing. They are not generic string utilities:
 * changing them invalidates stored vectors.
 */

/**
 * Vector width of `commit_embeddings.embedding` (pgvector `vector(768)`).
 *
 * This is a database-level constraint, not a provider default: every stored
 * vector and every HNSW comparison must match it. Providers that support the
 * OpenAI `dimensions` override are asked to truncate to this width; providers
 * that do not must use a model that natively emits this many dimensions.
 */
export const EMBEDDING_DIMENSIONS = 768;

/** The text fed to the embedding model: file paths + diff-grounded summary. */
export function commitEmbeddingText(
  filesChanged: string[],
  summary: string,
): string {
  const paths = [...new Set(filesChanged)].slice(0, 30);
  return `${paths.join(", ")}\n${summary}`;
}
