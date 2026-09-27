import type { ChatCitation } from "@/db/schema";
import { embedTexts } from "@/projects/embeddings";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";

export const RETRIEVAL_LIMIT = 20;

/** Cosine distance threshold: rows beyond this are too unrelated to cite. */
export const MAX_COSINE_DISTANCE = 0.45;

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function queryText(opts: { query: string; startDate?: Date; endDate?: Date }): string {
  // Stored embeddings are "YYYY-MM-DD <message>". Only prepend a date
  // when the caller explicitly set a window — that date is derived from
  // actual commits so it aligns. Unscoped queries (e.g. "last feature")
  // embed raw text so the vector match is purely topical.
  const date = opts.endDate ?? opts.startDate;
  return date ? `${fmtDate(date)} ${opts.query}` : opts.query;
}

function toCitation(row: commitChunksStore.CommitSearchResult): ChatCitation {
  return {
    commitSha: row.commitSha,
    commitMessage: row.commitMessage,
    author: row.author ?? null,
    committedAt: row.committedAt.toISOString(),
    filesChanged: row.metadata?.filesChanged ?? [],
    commitUrl: row.metadata?.commitUrl ?? null,
  };
}

export async function retrieveCommits(opts: {
  projectId: string;
  query: string;
  limit?: number;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<ChatCitation[]> {
  const limit = opts.limit ?? RETRIEVAL_LIMIT;
  const embeddedCount = await commitChunksStore.countChunksForProject({
    projectId: opts.projectId,
    branch: opts.branch,
    embeddedOnly: true,
  });

  let rows: commitChunksStore.CommitSearchResult[] | null = null;
  if (embeddedCount > 0) {
    try {
      const [embedding] = await embedTexts([queryText(opts)]);
      rows = await commitChunksStore.semanticSearchCommits({
        projectId: opts.projectId,
        embedding,
        limit,
        branch: opts.branch,
        startDate: opts.startDate,
        endDate: opts.endDate,
      });
    } catch {
      rows = null;
    }
  }

  if (!rows || rows.length === 0) {
    // Keyword is a coarse text-match fallback — keep the ceiling low
    // since it has no real distance signal to filter on.
    rows = await commitChunksStore.keywordSearchCommits({
      projectId: opts.projectId,
      query: opts.query,
      limit: 10,
      branch: opts.branch,
      startDate: opts.startDate,
      endDate: opts.endDate,
    });
  }

  // Keyword results (distance = null) have no vector score, only a coarse
  // text match. Include them but keep the ceiling low — they're a fallback.
  return rows
    .filter((r) => r.distance == null || r.distance <= MAX_COSINE_DISTANCE)
    .map(toCitation);
}