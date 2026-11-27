import { env } from "@/shared/config/env";
import {
  ingestCommits,
  type IngestProgress,
  type IngestResult,
} from "@/rag/indexing/ingest";
import { createGitCommitSource } from "@/rag/indexing/sources/git-source";
import { createApiCommitSource } from "@/rag/indexing/sources/api-source";
import { commitEmbeddingsStore } from "@/rag/indexing/commit-embeddings-store";
import { branchSyncStore } from "@/rag/indexing/branch-sync-store";
import { reindexAllProjects } from "@/rag/indexing/reindex-embeddings";
import { ingestionTelemetry } from "@/rag/indexing/ingestion-telemetry";
import {
  registerJobHandler,
  type JobContext,
  type JobReporter,
} from "@/shared/queue";
import { JOB_NAMES } from "@/shared/queue/jobs";
import type { GitProviderId } from "@/shared/integrations/git-provider";

export type IngestJobPayload = {
  gitProvider: GitProviderId;
  owner: string;
  repo: string;
  branch: string;
  projectId: string;
  /** Only walk commits at/after this ISO date (incremental re-ingest). */
  since?: string;
  /** Correlation id of the request that triggered the ingest (if any). */
  requestId?: string;
};

/**
 * The one heavy ingestion job. The demo/self-hosted split selects the commit
 * source; the shared orchestrator runs the pipeline either way. Exported so
 * tests can drive it without going through the queue registry.
 */
export async function runIngestBranchJob(
  payload: unknown,
  report: JobReporter,
  ctx: JobContext,
): Promise<IngestResult> {
  const { gitProvider, owner, repo, branch, projectId, since, requestId } =
    payload as IngestJobPayload;
  const startDate = since ? new Date(since) : undefined;
  const onProgress: IngestProgress = (stage, message, done, total) =>
    report({ stage, message, done, total });

  const run = ingestionTelemetry.start({
    jobId: ctx.jobId,
    jobType: "ingest-branch",
    projectId,
    branch,
  });

  const source = env.isDemoMode
    ? createApiCommitSource({ gitProvider, owner, repo, branch })
    : createGitCommitSource({ gitProvider, owner, repo, branch });

  try {
    const result = await ingestCommits(source, {
      gitProvider,
      owner,
      repo,
      branch,
      projectId,
      startDate,
      requestId,
      onProgress,
    });

    let syncDbMs = 0;
    if (!env.isDemoMode) {
      const syncStart = performance.now();
      const lastCommitAt = await commitEmbeddingsStore.getLatestCommitDate({
        repoId: projectId,
        branch,
      });
      await branchSyncStore.markIngested({
        projectId,
        branch,
        tipSha: result.tipSha,
        lastCommitAt,
      });
      syncDbMs = performance.now() - syncStart;
    }

    await run.finish({
      commitsFound: result.commitsFound,
      commitsWritten: result.chunksWritten,
      commitsEmbedded: result.embedded,
      gitMs: result.gitMs,
      dbMs: result.dbMs + syncDbMs,
      embeddingMs: result.embeddingMs,
      embeddingProvider: result.embeddingProvider,
      embeddingModel: result.embeddingModel,
      embeddingInputTokens: result.embeddingInputTokens,
      embeddingOutputTokens: result.embeddingOutputTokens,
    });

    return result;
  } catch (error) {
    await run.fail(error);
    throw error;
  } finally {
    await source.dispose?.();
  }
}

export async function runReindexEmbeddingsJob(
  _payload: unknown,
  _report: JobReporter,
  ctx: JobContext,
): Promise<Awaited<ReturnType<typeof reindexAllProjects>>> {
  const run = ingestionTelemetry.start({
    jobId: ctx.jobId,
    jobType: "reindex-embeddings",
  });

  try {
    const result = await reindexAllProjects();
    await run.finish({
      commitsEmbedded: result.embedded,
      dbMs: result.dbMs,
      embeddingProvider: result.provider,
      embeddingModel: result.model,
      embeddingInputTokens: result.embeddingInputTokens,
      embeddingOutputTokens: result.embeddingOutputTokens,
    });
    return result;
  } catch (error) {
    await run.fail(error);
    throw error;
  }
}

registerJobHandler(JOB_NAMES.ingestBranch, runIngestBranchJob);
registerJobHandler(JOB_NAMES.reindexEmbeddings, runReindexEmbeddingsJob);
