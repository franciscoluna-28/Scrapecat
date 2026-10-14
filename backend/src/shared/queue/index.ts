import { createMemoryQueue } from "./memory-queue";
import type { JobQueue } from "./job-queue";

export type { JobContext, JobHandler, JobProgress, JobQueue, JobReporter } from "./job-queue";
export { registerJobHandler } from "./registry";

let cached: JobQueue | null = null;

/**
 * Returns the in-process job queue. Jobs run inline on `runAndWait`, deduping
 * concurrent callers by id — no external infrastructure.
 */
export function getJobQueue(): JobQueue {
  if (!cached) cached = createMemoryQueue();
  return cached;
}

/** Releases the queue. Idempotent; safe to call when unused. */
export async function shutdownJobQueue(): Promise<void> {
  if (!cached) return;
  await cached.shutdown();
  cached = null;
}

/** Test hook: drops the cached queue. */
export function resetJobQueue(): void {
  cached = null;
}
