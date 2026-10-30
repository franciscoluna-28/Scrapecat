import { formatDate } from "./date";

/**
 * Domain-specific embedding helpers for commit chunks.
 *
 * Kept here rather than in a store/service so the same text/hash rules are
 * reused by ingestion, backfill, and the embedding client. They are not
 * generic string utilities: changing them invalidates stored vectors.
 */

/** The text actually fed to the embedding model: `YYYY-MM-DD <message>`. */
export function embeddingSource(date: Date, message: string): string {
  return `${formatDate(date)} ${message}`;
}
