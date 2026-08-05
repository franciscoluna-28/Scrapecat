import { logger } from "@/shared/logger";
import * as syncStateStore from "@/projects/stores/sync-state-store";
import * as syncJobsStore from "@/projects/stores/sync-jobs-store";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";
import { env } from "@/config/env";

export class SyncError extends Error {
  readonly status = 503;
  constructor(message: string) {
    super(message);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Idempotent: delegates to the worker by enqueueing a sync job (no-op if a
 * pending/running job already exists for the project+branch). This is what
 * reports and RAG call — they never touch the git provider themselves.
 */
export async function enqueueSync({
  projectId,
  branch,
}: {
  projectId: string;
  branch: string;
}): Promise<{ jobId: string; status: string }> {
  const job = await syncJobsStore.enqueueSyncJob({ projectId, branch });
  logger.info(
    { event: "sync.enqueued", jobId: job.id, projectId, branch, status: job.status },
    "sync job enqueued",
  );
  return { jobId: job.id, status: job.status };
}

export type SyncStatus = {
  projectId: string;
  branch: string;
  watermark: { sha: string; at: Date } | null;
  latestJob: {
    id: string;
    status: syncJobsStore.SyncJobStatus;
    attempts: number;
    error: string | null;
    scheduledAt: Date;
    startedAt: Date | null;
    finishedAt: Date | null;
  } | null;
  totals: { chunks: number; embedded: number };
};

export async function getSyncStatus(opts: {
  projectId: string;
  branch: string;
}): Promise<SyncStatus> {
  const [state, latestJob, chunks, embedded] = await Promise.all([
    syncStateStore.getSyncState(opts),
    syncJobsStore.getLatestSyncJob(opts),
    commitChunksStore.countChunksForProject({ ...opts, embeddedOnly: false }),
    commitChunksStore.countChunksForProject({ ...opts, embeddedOnly: true }),
  ]);

  return {
    projectId: opts.projectId,
    branch: opts.branch,
    watermark: state ? { sha: state.lastSyncedCommitSha, at: state.lastSyncedAt } : null,
    latestJob: latestJob
      ? {
          id: latestJob.id,
          status: latestJob.status,
          attempts: latestJob.attempts,
          error: latestJob.lastError,
          scheduledAt: latestJob.scheduledAt,
          startedAt: latestJob.startedAt,
          finishedAt: latestJob.finishedAt,
        }
      : null,
    totals: { chunks, embedded },
  };
}

/**
 * Blocks until the project is synced past `needByUtc` OR the worker has just
 * caught up to GitHub's tip (a recent successful job). The latter matters
 * because the watermark can never exceed the newest commit on the branch — if
 * GitHub has nothing after `needByUtc`, a successful catch-up IS "synced".
 *
 * Throws SyncError on permanent job failure or if the wait times out.
 */
export async function ensureSynced(opts: {
  projectId: string;
  branch: string;
  needByUtc?: Date;
  timeoutMs?: number;
}): Promise<"fresh" | "synced"> {
  const needBy = (opts.needByUtc ?? new Date()).getTime();
  const deadline = Date.now() + (opts.timeoutMs ?? env.SYNC_JOB_AWAIT_TIMEOUT_MS);

  for (;;) {
    const [state, latest] = await Promise.all([
      syncStateStore.getSyncState({ projectId: opts.projectId, branch: opts.branch }),
      syncJobsStore.getLatestSyncJob({ projectId: opts.projectId, branch: opts.branch }),
    ]);

    // Covered by the watermark directly.
    if (state && state.lastSyncedAt.getTime() >= needBy) {
      return "fresh";
    }

    // A recent successful catch-up means we reached GitHub's tip — the store
    // is as current as GitHub allows, so stop waiting. This also prevents
    // re-enqueueing forever when the branch simply has no commits after the
    // requested date.
    if (
      latest &&
      latest.status === "succeeded" &&
      latest.finishedAt &&
      Date.now() - latest.finishedAt.getTime() < env.SYNC_STALENESS_MS
    ) {
      logger.info(
        {
          event: "sync.caught-up",
          projectId: opts.projectId,
          branch: opts.branch,
          lastSyncedAt: state?.lastSyncedAt.toISOString(),
        },
        "sync caught up to the branch tip",
      );
      return "synced";
    }

    // Delegate to the worker (idempotent while a job is active).
    const job = await syncJobsStore.enqueueSyncJob({
      projectId: opts.projectId,
      branch: opts.branch,
    });

    // Fail fast on a permanent failure of the active job.
    if (latest && latest.status === "failed" && latest.id === job.id) {
      throw new SyncError(
        `Commit sync failed: ${latest.lastError ?? "unknown error"}`,
      );
    }

    if (Date.now() >= deadline) {
      throw new SyncError(
        `Timed out waiting for commit sync of ${opts.projectId}@${opts.branch}`,
      );
    }

    await sleep(500);
  }
}
