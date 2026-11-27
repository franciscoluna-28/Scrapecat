import { env } from "@/shared/config/env";
import { logger } from "@/shared/logger";
import {
  commitUrl,
  type GitProviderId,
} from "@/shared/integrations/git-provider";
import { contentHashOf, commitEmbeddingText } from "@/shared/utils";
import {
  commitEmbeddingsStore,
  type EmbeddingWrite,
} from "@/rag/indexing/commit-embeddings-store";
import {
  embedTextsWithUsage,
  resolveEmbeddingSpace,
  type EmbeddingSpace,
} from "@/rag/indexing/embeddings";
import type { CommitSource } from "@/rag/indexing/source";

export type IngestResult = {
  commitsFound: number;
  chunksWritten: number;
  summarized: number;
  embedded: number;
  gitMs: number;
  dbMs: number;
  embeddingMs: number;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingInputTokens: number | null;
  embeddingOutputTokens: number | null;
  tipSha: string;
};

export type IngestProgress = (
  stage: "archive" | "commits" | "ingest" | "embedding",
  message: string,
  done?: number,
  total?: number,
) => void;

async function resolveSpaceSafe(): Promise<EmbeddingSpace | null> {
  try {
    return await resolveEmbeddingSpace();
  } catch (error) {
    logger.warn(
      { err: (error as Error)?.message ?? String(error) },
      "embedding space unavailable; commits will be stored without vectors",
    );
    return null;
  }
}

function isFatalEmbeddingError(error: unknown): boolean {
  const err = error as {
    status?: number;
    code?: number | string;
    message?: string;
  };
  const status =
    typeof err?.status === "number"
      ? err.status
      : typeof err?.code === "number"
        ? err.code
        : undefined;
  if (status === 401 || status === 403) return true;

  const message = (err?.message ?? String(error)).toLowerCase();
  return /invalid api key|incorrect api key|key limit exceeded|quota|unauthorized|authentication|missing authentication/.test(
    message,
  );
}

/**
 * Ingests the commit window: diff -> embedding -> commit_embeddings.
 *
 * LLM summaries are disabled for now: the original message + files are the
 * embedding text and the summary columns stay empty. Embedding failures never
 * fail ingestion.
 */
export async function ingestCommits(
  source: CommitSource,
  opts: {
    gitProvider: GitProviderId;
    owner: string;
    repo: string;
    branch: string;
    projectId: string;
    startDate?: Date;
    endDate?: Date;
    requestId?: string;
    onProgress?: IngestProgress;
  },
): Promise<IngestResult> {
  const { owner, repo, branch, projectId, startDate, endDate, onProgress } = opts;
  const base = {
    owner,
    repo,
    branch,
    projectId,
    ...(opts.requestId ? { reqId: opts.requestId } : {}),
  };

  let gitMs = 0;
  let dbMs = 0;

  const listStart = performance.now();
  const { commits, tipSha } = await source.listCommits({
    since: startDate,
    until: endDate,
  });
  gitMs += performance.now() - listStart;

  onProgress?.(
    "commits",
    `Found ${commits.length} commits`,
    commits.length,
    commits.length,
  );

  const spaceStart = performance.now();
  const space = env.EMBEDDING_ENABLED ? await resolveSpaceSafe() : null;
  dbMs += performance.now() - spaceStart;

  let written = 0;
  let embedded = 0;
  let embeddingMs = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let inputTokensKnown = true;
  let outputTokensKnown = true;
  let embeddingDisabled = false;

  for (const commit of commits) {
    const existingStart = performance.now();
    const existing = await commitEmbeddingsStore.getByKey({
      repoId: projectId,
      branch,
      commitSha: commit.sha,
    });
    dbMs += performance.now() - existingStart;

    const diffStart = performance.now();
    const diff = await source.readDiff(commit);
    gitMs += performance.now() - diffStart;
    if (!diff) continue;

    const contentText = commitEmbeddingText(diff.filesChanged, commit.message);
    const contentHash = contentHashOf(contentText);
    const existingEmbeddingIsCurrent =
      space &&
      existing?.embeddingHash === contentHash &&
      existing.embeddingProvider === space.provider &&
      existing.embeddingModel === space.model;

    let embedding: EmbeddingWrite | undefined;
    if (existingEmbeddingIsCurrent) {
      embedded += 1;
    } else if (space && !embeddingDisabled) {
      const embedStart = performance.now();
      try {
        const { embeddings, usage } = await embedTextsWithUsage([contentText], space);
        const vector = embeddings[0]!;
        embedding = { vector, provider: space.provider, model: space.model };
        embedded += 1;
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
      } catch (error) {
        const message = (error as Error)?.message ?? String(error);
        if (isFatalEmbeddingError(error)) {
          embeddingDisabled = true;
          logger.warn(
            { ...base, err: message },
            "embedding provider rejected credentials; skipping embeddings for the rest of this run",
          );
        } else {
          logger.warn(
            { ...base, sha: commit.sha, err: message },
            "commit embedding failed; stored commit without a vector",
          );
        }
      } finally {
        embeddingMs += performance.now() - embedStart;
      }
    }

    const upsertStart = performance.now();
    await commitEmbeddingsStore.upsertCommit({
      repoId: projectId,
      branch,
      commitSha: commit.sha,
      author: commit.author || null,
      committedAt: new Date(commit.date),
      message: commit.message,
      commitUrl:
        commit.url || commitUrl(opts.gitProvider, owner, repo, commit.sha),
      filesChanged: diff.filesChanged,
      diffHash: diff.hash,
      contentHash,
      ...(embedding ? { embedding } : {}),
    });
    dbMs += performance.now() - upsertStart;

    written += 1;
    onProgress?.(
      "ingest",
      `Stored ${written} of ${commits.length} commits`,
      written,
      commits.length,
    );
  }

  if (embedded > 0) {
    onProgress?.("embedding", `Embedded ${embedded} commits`);
  }

  const totalGitMs = Math.round(gitMs);
  const totalDbMs = Math.round(dbMs);
  const totalEmbeddingMs = Math.round(embeddingMs);
  const totalInputTokens = inputTokensKnown ? inputTokens : null;
  const totalOutputTokens = outputTokensKnown ? outputTokens : null;

  logger.info(
    {
      ...base,
      commitsFound: commits.length,
      chunksWritten: written,
      summarized: 0,
      embedded,
      gitMs: totalGitMs,
      dbMs: totalDbMs,
      embeddingMs: totalEmbeddingMs,
      embeddingProvider: space?.provider ?? null,
      embeddingModel: space?.model ?? null,
      embeddingInputTokens: totalInputTokens,
      embeddingOutputTokens: totalOutputTokens,
      tipSha,
    },
    "ingest complete",
  );

  return {
    commitsFound: commits.length,
    chunksWritten: written,
    summarized: 0,
    embedded,
    gitMs: totalGitMs,
    dbMs: totalDbMs,
    embeddingMs: totalEmbeddingMs,
    embeddingProvider: space?.provider ?? null,
    embeddingModel: space?.model ?? null,
    embeddingInputTokens: totalInputTokens,
    embeddingOutputTokens: totalOutputTokens,
    tipSha,
  };
}
