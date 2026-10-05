import { env } from "@/config/env";
import { createMemoryQueue } from "./memory-queue";
import type { JobQueue } from "./job-queue";

export type { JobContext, JobHandler, JobProgress, JobQueue, JobReporter } from "./job-queue";
export { registerJobHandler } from "./registry";

let cached: Promise<JobQueue> | null = null;

/**
 * Resolves the configured job queue. `memory` (default) runs inline; `bullmq`
 * lazily loads Redis so fs/memory modes never pay for it.
 */
export function getJobQueue(): Promise<JobQueue> {
  if (!cached) {
    cached =
      env.QUEUE_DRIVER === "bullmq"
        ? import("./bullmq-queue").then((m) => m.createBullmqQueue())
        : Promise.resolve(createMemoryQueue());
  }
  return cached;
}

/** Closes the queue if one was created. Safe to call when unused. */
export async function shutdownJobQueue(): Promise<void> {
  if (!cached) return;
  const queue = await cached.catch(() => null);
  cached = null;
  await queue?.shutdown();
}

/** Test hook: drops the cached queue so the next call re-reads the env. */
export function resetJobQueue(): void {
  cached = null;
}
