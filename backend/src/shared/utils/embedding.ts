import { formatDate } from "./date";

/**
 * Domain-specific embedding helpers for commit chunks.
 *
 * Kept here rather than in a store/service so the same text/hash rules are
 * reused by ingestion, backfill, and the embedding client. They are not
 * generic string utilities: changing them invalidates stored vectors.
 */

/**
 * Vector width of `commit_chunks.embedding` (pgvector `vector(768)`).
 *
 * This is a database-level constraint, not a provider default: every stored
 * vector and every HNSW comparison must match it. Providers that support the
 * OpenAI `dimensions` override are asked to truncate to this width; providers
 * that do not must use a model that natively emits this many dimensions.
 */
export const EMBEDDING_DIMENSIONS = 768;

/** The text actually fed to the embedding model: `YYYY-MM-DD <message>`. */
export function embeddingSource(date: Date, message: string): string {
  return `${formatDate(date)} ${message}`;
}
