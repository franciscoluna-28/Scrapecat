import { logger } from "@/shared/logger";
import * as syncJobsStore from "@/projects/stores/sync-jobs-store";
import { runProjectSync } from "@/projects/sync";
import { embedNewChunks } from "@/projects/embed-chunks";
import { env } from "@/config/env";

let running = false;
let timer: NodeJS.Timeout | null = null;

async function runJob(job: syncJobsStore.SyncJob): Promise<void> {
  const attempt = job.attempts + 1;
  logger.info(
    { event: "sync.job.start", jobId: job.id, projectId: job.projectId, branch: job.branch, attempt },
    "sync job started",
  );

  try {
    const result = await runProjectSync({ projectId: job.projectId, branch: job.branch });
    await syncJobsStore.completeSyncJob({ jobId: job.id });

    logger.info(
      {
        event: "sync.job.complete",
        jobId: job.id,
        projectId: job.projectId,
        branch: job.branch,
        fetched: result.fetched,
        newChunks: result.newChunks,
        watermarkFromSha: result.watermarkFrom?.sha,
        watermarkFromAt: result.watermarkFrom?.at.toISOString(),
        watermarkToSha: result.watermarkTo?.sha,
        watermarkToAt: result.watermarkTo?.at.toISOString(),
      },
      "sync job completed",
    );

    if (result.newChunks > 0) {
      try {
        const emb = await embedNewChunks(job.projectId);
        logger.info(
          { event: "sync.embed", jobId: job.id, projectId: job.projectId, embedded: emb.embedded },
          "embedding sync done",
        );
      } catch (err) {
        logger.warn(
          {
            event: "sync.embed.failed",
            jobId: job.id,
            projectId: job.projectId,
            error: (err as Error)?.message ?? err,
          },
          "embedding sync failed (will be retried by backfill)",
        );
      }
    }
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    await syncJobsStore.failSyncJob({
      jobId: job.id,
      error: message,
      attempts: attempt,
      maxAttempts: env.SYNC_MAX_ATTEMPTS,
    });
    logger.error(
      {
        event: "sync.job.failed",
        jobId: job.id,
        projectId: job.projectId,
        branch: job.branch,
        attempt,
        maxAttempts: env.SYNC_MAX_ATTEMPTS,
        error: message,
      },
      "sync job failed",
    );
  }
}

/** Claims and runs the next ready job. Returns how many jobs ran. */
export async function processNextJobs(limit = 1): Promise<number> {
  const jobs = await syncJobsStore.claimNextSyncJob({ limit });
  for (const job of jobs) {
    await runJob(job);
  }
  return jobs.length;
}

/** Starts the background poll loop. Safe to call multiple times. */
export function startSyncWorker(): void {
  if (running) return;
  running = true;

  const tick = async () => {
    if (!running) return;
    try {
      await processNextJobs();
    } catch (err) {
      logger.error(
        { event: "sync.worker.poll.error", error: (err as Error)?.message ?? err },
        "sync worker poll failed",
      );
    }
    timer = setTimeout(tick, env.SYNC_POLL_INTERVAL_MS);
  };

  tick();
}

export function stopSyncWorker(): void {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}
