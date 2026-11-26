import { env } from "@/shared/config/env";
import { ingestCommits, type IngestProgress } from "@/rag/indexing/ingest";
import { createGitCommitSource } from "@/rag/indexing/sources/git-source";
import { createApiCommitSource } from "@/rag/indexing/sources/api-source";
import { commitChunksStore } from "@/rag/indexing/commit-chunks-store";
import { branchSyncStore } from "@/rag/indexing/branch-sync-store";
import { reindexAllProjects } from "@/rag/indexing/embed-chunks";
import { registerJobHandler } from "@/shared/queue";
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
 * The one heavy ingestion job. Registered as a side effect so the queue can
 * resolve it. The demo/self-hosted split selects the commit source; the shared
 * orchestrator runs the pipeline either way.
 */
registerJobHandler(JOB_NAMES.ingestBranch, async (payload, report) => {
  const { gitProvider, owner, repo, branch, projectId, since, requestId } =
    payload as IngestJobPayload;
  const startDate = since ? new Date(since) : undefined;
  const onProgress: IngestProgress = (stage, message, done, total) =>
    report({ stage, message, done, total });

  if (env.isDemoMode) {
    const source = createApiCommitSource({ gitProvider, owner, repo, branch });
    return ingestCommits(source, {
      owner,
      repo,
      branch,
      projectId,
      startDate,
      requestId,
      onProgress,
    });
  }

  const source = createGitCommitSource({ gitProvider, owner, repo, branch });
  try {
    const result = await ingestCommits(source, {
      owner,
      repo,
      branch,
      projectId,
      startDate,
      requestId,
      onProgress,
    });
    const lastCommitAt = await commitChunksStore.getLatestCommitDate({ projectId, branch });
    await branchSyncStore.markIngested({
      projectId,
      branch,
      tipSha: result.tipSha,
      lastCommitAt,
    });
    return result;
  } finally {
    await source.dispose?.();
  }
});

registerJobHandler(JOB_NAMES.reindexEmbeddings, async () => {
  return reindexAllProjects();
});
