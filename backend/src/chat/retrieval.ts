import type { ChatCitation } from "@/db/schema";
import { embedTexts } from "@/projects/embeddings";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import type { CommitSearchResult } from "@/projects/stores/commit-chunks-store";

export const RETRIEVAL_LIMIT = 8;

function toCitation(row: CommitSearchResult): ChatCitation {
  return {
    commitSha: row.commitSha,
    commitMessage: row.commitMessage,
    author: row.author ?? null,
    committedAt: row.committedAt.toISOString(),
    filesChanged: row.metadata?.filesChanged ?? [],
    commitUrl: row.metadata?.commitUrl ?? null,
  };
}

/**
 * Retrieves the most relevant commits for a question. Vector search first
 * (over the HNSW index); if the project has no embeddings yet or embedding
 * fails, falls back to a keyword match on the message + file scope.
 */
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

  let rows: CommitSearchResult[] | null = null;
  if (embeddedCount > 0) {
    try {
      const [embedding] = await embedTexts([opts.query]);
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
    rows = await commitChunksStore.keywordSearchCommits({
      projectId: opts.projectId,
      query: opts.query,
      limit,
      branch: opts.branch,
      startDate: opts.startDate,
      endDate: opts.endDate,
    });
  }

  return rows.map(toCitation);
}
