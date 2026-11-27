import { env } from "@/shared/config/env";
import { logger } from "@/shared/logger";
import { commitEmbeddingsStore } from "@/rag/indexing/commit-embeddings-store";
import { commitEmbeddingText, contentHashOf } from "@/shared/utils";
import {
  embedTextsWithUsage,
  resolveEmbeddingSpace,
  type EmbeddingSpace,
} from "@/rag/indexing/embeddings";

export type ReindexEmbeddingsResult = {
  provider: string;
  model: string;
  projects: number;
  embedded: number;
  dbMs: number;
  embeddingInputTokens: number | null;
  embeddingOutputTokens: number | null;
};

/**
 * Re-embeds commit summaries that are missing a vector or live in another
 * vector space. No summaries or diffs are regenerated here.
 */
export async function reindexAllProjects(opts?: {
  space?: EmbeddingSpace;
  batchSize?: number;
}): Promise<ReindexEmbeddingsResult> {
  if (!env.EMBEDDING_ENABLED) {
    return {
      provider: "",
      model: "",
      projects: 0,
      embedded: 0,
      dbMs: 0,
      embeddingInputTokens: 0,
      embeddingOutputTokens: 0,
    };
  }

  let dbMs = 0;

  const spaceStart = performance.now();
  const space = opts?.space ?? (await resolveEmbeddingSpace());
  dbMs += performance.now() - spaceStart;

  const projectsStart = performance.now();
  const repoIds = await commitEmbeddingsStore.listProjectIds();
  dbMs += performance.now() - projectsStart;

  let embedded = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let inputTokensKnown = true;
  let outputTokensKnown = true;

  for (const repoId of repoIds) {
    const pendingStart = performance.now();
    const pending = await commitEmbeddingsStore.listPendingEmbeddings({
      repoId,
      space,
    });
    dbMs += performance.now() - pendingStart;

    for (const row of pending) {
      const text = commitEmbeddingText(row.filesChanged, row.message);
      const contentHash = row.contentHash ?? contentHashOf(text);
      try {
        const { embeddings, usage } = await embedTextsWithUsage([text], space);
        const vector = embeddings[0]!;
        if (usage.inputTokens === null) {
          inputTokensKnown = false;
        } else {
          inputTokens += usage.inputTokens;
        }
        if (usage.outputTokens === null) {
          outputTokensKnown = false;
        } else {
          outputTokens += usage.outputTokens;
        }
        const updateStart = performance.now();
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
        dbMs += performance.now() - updateStart;
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

  const totalDbMs = Math.round(dbMs);
  const totalInputTokens = inputTokensKnown ? inputTokens : null;
  const totalOutputTokens = outputTokensKnown ? outputTokens : null;

  logger.info(
    {
      provider: space.provider,
      model: space.model,
      projects: repoIds.length,
      embedded,
      dbMs: totalDbMs,
      embeddingInputTokens: totalInputTokens,
      embeddingOutputTokens: totalOutputTokens,
    },
    "commit embedding reindex complete",
  );

  return {
    provider: space.provider,
    model: space.model,
    projects: repoIds.length,
    embedded,
    dbMs: totalDbMs,
    embeddingInputTokens: totalInputTokens,
    embeddingOutputTokens: totalOutputTokens,
  };
}
