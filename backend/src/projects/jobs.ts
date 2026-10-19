import { env } from "@/config/env";
import { ingestCommits, type IngestProgress } from "@/repositories/ingest";
import { createGitCommitSource } from "@/repositories/git-source";
import { createApiCommitSource } from "@/repositories/api-source";
import { wipeJobScratch } from "@/repositories/archive-service";
import { registerJobHandler } from "@/shared/queue";

export type IngestJobPayload = {
  owner: string;
  repo: string;
  branch: string;
  projectId: string;
};

/**
 * The one heavy ingestion job. Registered as a side effect so the queue can
 * resolve it. The demo/self-hosted split selects the commit source; the shared
 * orchestrator runs the pipeline either way.
 */
registerJobHandler("ingest-branch", async (payload, report, ctx) => {
  const { owner, repo, branch, projectId } = payload as IngestJobPayload;
  const onProgress: IngestProgress = (stage, message, done, total) =>
    report({ stage, message, done, total });

  if (env.isDemoMode) {
    const source = createApiCommitSource({ owner, repo, branch });
    return ingestCommits(source, { owner, repo, branch, projectId, onProgress });
  }

  try {
    const source = createGitCommitSource({ owner, repo, branch, jobId: ctx.jobId });
    return await ingestCommits(source, { owner, repo, branch, projectId, onProgress });
  } finally {
    // No-op unless the s3 store is active (disposable job scratch).
    await wipeJobScratch(ctx.jobId);
  }
});
