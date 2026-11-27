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
  commitSummaryService,
  COMMIT_SUMMARY_VERSION,
  fallbackCommitSummary,
} from "@/rag/indexing/commit-summary-service";
import {
  embedTexts,
  resolveEmbeddingSpace,
  type EmbeddingSpace,
} from "@/rag/indexing/embeddings";
import type { ResolvedChatModel } from "@/rag/answer/ai";
import type { CommitSource, SourceCommit } from "@/rag/indexing/source";

export type IngestResult = {
  commitsFound: number;
  chunksWritten: number;
  summarized: number;
  embedded: number;
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
      "embedding space unavailable; summaries will be stored without vectors",
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

async function resolveSummaryModelSafe(): Promise<ResolvedChatModel | null> {
  try {
    return await commitSummaryService.resolveModel();
  } catch (error) {
    logger.warn(
      { err: (error as Error)?.message ?? String(error) },
      "summary model unavailable; using structural summaries",
    );
    return null;
  }
}

/**
 * Ingests the commit window: diff -> summary -> embedding -> commit_embeddings.
 *
 * The diff is the source of truth; the message is a gated hint inside the
 * summary service. Embedding failures never fail ingestion.
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

  const { commits, tipSha } = await source.listCommits({
    since: startDate,
    until: endDate,
  });
  onProgress?.(
    "commits",
    `Found ${commits.length} commits`,
    commits.length,
    commits.length,
  );

  const space = env.EMBEDDING_ENABLED ? await resolveSpaceSafe() : null;
  const model = await resolveSummaryModelSafe();
  const targetModel = model?.model.id ?? null;

  let written = 0;
  let summarized = 0;
  let embedded = 0;
  let embeddingDisabled = false;

  for (const commit of commits) {
    const existing = await commitEmbeddingsStore.getByKey({
      repoId: projectId,
      branch,
      commitSha: commit.sha,
    });

    const diff = await source.readDiff(commit);
    if (!diff) continue;

    let summary: string;
    let summaryModel: string;
    let reusable = null as Awaited<
      ReturnType<typeof commitEmbeddingsStore.findReusableSummary>
    >;

    const canReuseExisting =
      existing &&
      existing.diffHash === diff.hash &&
      existing.summaryVersion === COMMIT_SUMMARY_VERSION &&
      existing.summary &&
      (!targetModel || existing.summaryModel === targetModel);

    if (canReuseExisting) {
      summary = existing.summary;
      summaryModel = existing.summaryModel;
    } else {
      reusable = await commitEmbeddingsStore.findReusableSummary({
        repoId: projectId,
        commitSha: commit.sha,
        diffHash: diff.hash,
        summaryVersion: COMMIT_SUMMARY_VERSION,
        ...(targetModel ? { summaryModel: targetModel } : {}),
        excludeBranch: branch,
      });

      if (reusable) {
        summary = reusable.summary;
        summaryModel = reusable.summaryModel;
      } else if (model) {
        const result = await commitSummaryService.summarize({
          commit,
          diff,
          model,
        });
        summary = result.summary;
        summaryModel = result.model;
      } else {
        summary = fallbackCommitSummary(diff);
        summaryModel = "fallback";
      }
    }

    const contentText = commitEmbeddingText(diff.filesChanged, summary);
    const contentHash = contentHashOf(contentText);
    const existingEmbeddingIsCurrent =
      space &&
      existing?.embeddingHash === contentHash &&
      existing.embeddingProvider === space.provider &&
      existing.embeddingModel === space.model;

    let embedding: EmbeddingWrite | undefined;
    if (existingEmbeddingIsCurrent) {
      embedded += 1;
    } else if (
      space &&
      reusable?.embedding &&
      reusable.embeddingHash === contentHash &&
      reusable.embeddingProvider === space.provider &&
      reusable.embeddingModel === space.model
    ) {
      embedding = {
        vector: reusable.embedding,
        provider: space.provider,
        model: space.model,
      };
      embedded += 1;
    } else if (space && !embeddingDisabled) {
      try {
        const [vector] = await embedTexts([contentText], space);
        embedding = { vector, provider: space.provider, model: space.model };
        embedded += 1;
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
            "commit embedding failed; stored summary without a vector",
          );
        }
      }
    }

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
      summary,
      summaryVersion: COMMIT_SUMMARY_VERSION,
      summaryModel,
      contentHash,
      ...(embedding ? { embedding } : {}),
    });

    written += 1;
    summarized += 1;
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

  logger.info(
    {
      ...base,
      commitsFound: commits.length,
      chunksWritten: written,
      summarized,
      embedded,
      tipSha,
    },
    "ingest complete",
  );

  return {
    commitsFound: commits.length,
    chunksWritten: written,
    summarized,
    embedded,
    tipSha,
  };
}
