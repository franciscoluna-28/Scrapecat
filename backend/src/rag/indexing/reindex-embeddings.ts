import { env } from "@/shared/config/env";
import { logger } from "@/shared/logger";
import { commitEmbeddingsStore } from "@/rag/indexing/commit-embeddings-store";
import { commitEmbeddingText, contentHashOf } from "@/shared/utils";
import {
  embedTexts,
  resolveEmbeddingSpace,
  type EmbeddingSpace,
} from "@/rag/indexing/embeddings";

/**
 * Re-embeds commit summaries that are missing a vector or live in another
 * vector space. No summaries or diffs are regenerated here.
 */
export async function reindexAllProjects(opts?: {
  space?: EmbeddingSpace;
  batchSize?: number;
}) {
  if (!env.EMBEDDING_ENABLED) {
    return { provider: "", model: "", projects: 0, embedded: 0 };
  }

  const space = opts?.space ?? (await resolveEmbeddingSpace());
  const repoIds = await commitEmbeddingsStore.listProjectIds();
  let embedded = 0;

  for (const repoId of repoIds) {
    const pending = await commitEmbeddingsStore.listPendingEmbeddings({
      repoId,
      space,
    });
    for (const row of pending) {
      const text = commitEmbeddingText(row.filesChanged, row.summary);
      const contentHash = row.contentHash ?? contentHashOf(text);
      try {
        const [vector] = await embedTexts([text], space);
        await commitEmbeddingsStore.updateEmbedding({
          key: {
            repoId,
            branch: row.branch,
            commitSha: row.commitSha,
          },
          embedding: {
            vector,
            provider: space.provider,
            model: space.model,
          },
          contentHash,
        });
        embedded += 1;
      } catch (error) {
        logger.warn(
          {
            repoId,
            branch: row.branch,
            sha: row.commitSha,
            err: (error as Error)?.message ?? String(error),
          },
          "commit embedding reindex failed",
        );
      }
    }
  }

  logger.info(
    {
      provider: space.provider,
      model: space.model,
      projects: repoIds.length,
      embedded,
    },
    "commit embedding reindex complete",
  );

  return {
    provider: space.provider,
    model: space.model,
    projects: repoIds.length,
    embedded,
  };
}
