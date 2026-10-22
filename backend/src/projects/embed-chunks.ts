import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import { commitChunks } from "@/db/schema";
import {
  contentHashOf,
  embeddingSource,
  updateChunkEmbeddings,
} from "@/projects/stores/commit-chunks-store";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import {
  embedTexts,
  resolveEmbeddingSpace,
  type EmbeddingSpace,
} from "@/projects/embeddings";

export async function listPendingChunks(
  projectId: string,
  space: EmbeddingSpace,
) {
  return db
    .select({
      id: commitChunks.id,
      commitMessage: commitChunks.commitMessage,
      committedAt: commitChunks.committedAt,
      contentHash: commitChunks.contentHash,
    })
    .from(commitChunks)
    .where(
      and(
        eq(commitChunks.projectId, projectId),
        or(
          isNull(commitChunks.embeddingHash),
          ne(commitChunks.embeddingHash, commitChunks.contentHash),
          isNull(commitChunks.embeddingProvider),
          ne(commitChunks.embeddingProvider, space.provider),
          isNull(commitChunks.embeddingModel),
          ne(commitChunks.embeddingModel, space.model),
        ),
      ),
    );
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function embedNewChunks(
  projectId: string,
  opts?: { batchSize?: number; space?: EmbeddingSpace },
) {
  if (!env.EMBEDDING_ENABLED) return { embedded: 0 };

  const space = opts?.space ?? (await resolveEmbeddingSpace());
  const pending = await listPendingChunks(projectId, space);
  if (pending.length === 0) return { embedded: 0 };

  const batchSize = Math.max(1, opts?.batchSize ?? env.EMBEDDING_BATCH_SIZE);
  let embedded = 0;
  const start = performance.now();

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize);
    const batchStart = performance.now();
    const texts = batch.map((chunk) => `${fmtDate(chunk.committedAt)} ${chunk.commitMessage}`);
    const vectors = await embedTexts(texts, space);

    await updateChunkEmbeddings({
      updates: batch.map((chunk, index) => ({
        id: chunk.id,
        embedding: vectors[index],
        contentHash:
          chunk.contentHash ??
          contentHashOf(embeddingSource(chunk.committedAt, chunk.commitMessage)),
      })),
      space,
    });

    embedded += batch.length;
    logger.info(
      {
        projectId,
        provider: space.provider,
        model: space.model,
        batchIndex: i / batchSize,
        batchSize: batch.length,
        durationMs: Math.round(performance.now() - batchStart),
      },
      "embedding batch complete",
    );
  }

  logger.info(
    {
      projectId,
      provider: space.provider,
      model: space.model,
      pending: pending.length,
      embedded,
      durationMs: Math.round(performance.now() - start),
    },
    "embedNewChunks complete",
  );

  return { embedded };
}

/**
 * Re-embeds stale rows across every project. Used after an embedding-model
 * change; the space is resolved once so a mid-run settings change cannot mix
 * vectors from different models.
 */
export async function reindexAllProjects(opts?: {
  space?: EmbeddingSpace;
  batchSize?: number;
}) {
  const space = opts?.space ?? (await resolveEmbeddingSpace());
  const projects = await db
    .selectDistinct({ projectId: commitChunks.projectId })
    .from(commitChunks);

  let embedded = 0;
  for (const project of projects) {
    try {
      const result = await embedNewChunks(project.projectId, {
        space,
        batchSize: opts?.batchSize,
      });
      embedded += result.embedded;
    } catch (error) {
      logger.warn(
        {
          projectId: project.projectId,
          provider: space.provider,
          model: space.model,
          err: (error as Error)?.message ?? String(error),
        },
        "embedding reindex failed for project",
      );
    }
  }

  logger.info(
    {
      provider: space.provider,
      model: space.model,
      projects: projects.length,
      embedded,
    },
    "embedding reindex complete",
  );

  return {
    provider: space.provider,
    model: space.model,
    projects: projects.length,
    embedded,
  };
}
