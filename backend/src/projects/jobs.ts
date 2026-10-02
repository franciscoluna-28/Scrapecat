import { env } from "@/config/env";
import { ingestCommits, type IngestProgress } from "@/repositories/ingest";
import { ingestCommitsFromApi } from "@/repositories/ingest-api";
import { wipeJobScratch } from "@/repositories/archive-service";
import { registerJobHandler } from "@/shared/queue";

export type IngestJobPayload = {
  owner: string;
  repo: string;
  branch: string;
  projectId: string;
};

/**
 * The one heavy ingestion job. Registered as a side effect so both queue
 * drivers (and, in bullmq mode, the in-process worker) can resolve it. The
 * demo/self-hosted split lives here, exactly as it did inline before.
 */
registerJobHandler("ingest-branch", async (payload, report, ctx) => {
  const { owner, repo, branch, projectId } = payload as IngestJobPayload;
  const onProgress: IngestProgress = (stage, message, done, total) =>
    report({ stage, message, done, total });

  if (env.isDemoMode) {
    return ingestCommitsFromApi({ owner, repo, branch, projectId, onProgress });
  }

  try {
    return await ingestCommits({
      owner,
      repo,
      branch,
      projectId,
      onProgress,
      jobId: ctx.jobId,
    });
  } finally {
    // No-op unless the s3 store is active (disposable job scratch).
    await wipeJobScratch(ctx.jobId);
  }
});
