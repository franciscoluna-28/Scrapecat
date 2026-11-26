import { env } from "@/shared/config/env";
import { ingestCommits, type IngestProgress } from "@/rag/indexing/ingest";
import { createGitCommitSource } from "@/rag/indexing/sources/git-source";
import { createApiCommitSource } from "@/rag/indexing/sources/api-source";
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
  /** Correlation id of the request that triggered the ingest (if any). */
  requestId?: string;
};

/**
 * The one heavy ingestion job. Registered as a side effect so the queue can
 * resolve it. The demo/self-hosted split selects the commit source; the shared
 * orchestrator runs the pipeline either way.
 */
registerJobHandler(JOB_NAMES.ingestBranch, async (payload, report) => {
  const { gitProvider, owner, repo, branch, projectId, requestId } = payload as IngestJobPayload;
  const onProgress: IngestProgress = (stage, message, done, total) =>
    report({ stage, message, done, total });

  if (env.isDemoMode) {
    const source = createApiCommitSource({ gitProvider, owner, repo, branch });
    return ingestCommits(source, { owner, repo, branch, projectId, requestId, onProgress });
  }

  const source = createGitCommitSource({ gitProvider, owner, repo, branch });
  return ingestCommits(source, { owner, repo, branch, projectId, requestId, onProgress });
});

registerJobHandler(JOB_NAMES.reindexEmbeddings, async () => {
  return reindexAllProjects();
});
