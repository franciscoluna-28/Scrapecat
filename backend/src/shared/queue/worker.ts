import { db } from "@/db/client";
import type { JobProgress, JobRow } from "@/db/schema";
import { logger } from "@/shared/logger";
import {
  claimNextJob,
  completeJob,
  failInterruptedJobs,
  failJob,
  updateJobProgress,
} from "./job-store";
import { getJobHandler } from "./registry";
import type { JobHandler } from "./job-queue";

const POLL_INTERVAL_MS = 500;
// Arbitrary app-wide key: only one backend process may run background jobs.
const WORKER_LOCK_KEY = 842001;

type WorkerLockConnection = Awaited<ReturnType<typeof db.$client.reserve>>;

let running = false;
let loop: Promise<void> | null = null;
let lockConnection: WorkerLockConnection | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Holds a pinned Postgres session for the process lifetime. A second replica
 * fails to acquire the lock and serves API only, so its boot reaper can never
 * fail jobs another replica is running.
 */
async function acquireWorkerLock(): Promise<boolean> {
  if (lockConnection) return true;

  const connection = await db.$client.reserve();
  const [row] = await connection<{ locked: boolean }[]>`
    select pg_try_advisory_lock(${WORKER_LOCK_KEY}::bigint) as locked
  `;
  if (!row?.locked) {
    connection.release();
    return false;
  }

  lockConnection = connection;
  return true;
}

async function releaseWorkerLock(): Promise<void> {
  if (!lockConnection) return;

  const connection = lockConnection;
  lockConnection = null;
  try {
    await connection`select pg_advisory_unlock(${WORKER_LOCK_KEY}::bigint)`;
  } finally {
    connection.release();
  }
}

function errorDetails(error: unknown): { message: string; code?: string } {
  const err = error as Error & { code?: string };
  return {
    message: err?.message ?? String(error),
    ...(err?.code ? { code: err.code } : {}),
  };
}

function requireHandler(type: string): JobHandler {
  const handler = getJobHandler(type);
  if (!handler) throw new Error(`No job handler registered for "${type}"`);
  return handler;
}

async function runJob(job: JobRow): Promise<void> {
  const started = performance.now();
  try {
    const handler = requireHandler(job.type);
    const result = await handler(
      job.payload,
      (progress) => {
        void updateJobProgress(job.id, progress).catch((error) => {
          logger.warn(
            { jobId: job.id, err: errorDetails(error).message },
            "job progress update failed",
          );
        });
      },
      { jobId: job.id },
    );
    await completeJob(job.id, result);
    logger.info(
      {
        jobId: job.id,
        type: job.type,
        attempts: job.attempts,
        durationMs: Math.round(performance.now() - started),
      },
      "job succeeded",
    );
  } catch (error) {
    const details = errorDetails(error);
    await failJob(job, details);
    logger.error(
      {
        jobId: job.id,
        type: job.type,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        err: details.message,
      },
      "job failed",
    );
  }
}

async function tick(): Promise<void> {
  const job = await claimNextJob();
  if (job) {
    await runJob(job);
    return;
  }
  await sleep(POLL_INTERVAL_MS);
}

/** Starts the single-process worker. Safe to call more than once. */
export async function startJobWorker(): Promise<void> {
  if (running) return;

  if (!(await acquireWorkerLock())) {
    logger.warn(
      { lockKey: WORKER_LOCK_KEY },
      "job worker lock held by another instance; serving API only",
    );
    return;
  }

  try {
    const interrupted = await failInterruptedJobs();
    if (interrupted > 0) {
      logger.info({ interrupted }, "failed jobs interrupted by restart");
    }

    running = true;
    loop = (async () => {
      while (running) {
        try {
          await tick();
        } catch (error) {
          logger.error(
            { err: errorDetails(error).message },
            "job worker tick failed",
          );
          await sleep(POLL_INTERVAL_MS);
        }
      }
    })();
  } catch (error) {
    await releaseWorkerLock();
    throw error;
  }
}

export async function stopJobWorker(): Promise<void> {
  running = false;
  if (loop) {
    await loop;
    loop = null;
  }
  await releaseWorkerLock();
}

/**
 * Serverless has no long-running worker, so the demo/Vercel path runs the
 * handler inline while the self-hosted path uses the durable queue.
 */
export async function runJobInline<T>(
  type: string,
  payload: unknown,
  onProgress?: (progress: JobProgress) => void,
): Promise<T> {
  const handler = requireHandler(type);
  return handler(payload, onProgress ?? (() => {}), {
    jobId: `inline:${type}`,
  }) as Promise<T>;
}
