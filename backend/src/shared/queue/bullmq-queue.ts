import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { getJobHandler } from "./registry";
import { deserializeJobError, serializeJobError } from "./job-errors";
import type { JobProgress, JobQueue, JobReporter } from "./job-queue";

// Upper bound on how long a waiter blocks. Git transfers allow 10 minutes;
// leave generous headroom for embedding after the fetch.
const JOB_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Redis-backed queue with the Worker running in this same process (set
 * `WORKER_ENABLED=false` for API-only replicas sharing one Redis). Progress is
 * forwarded through `job.updateProgress` → QueueEvents → the waiter, so SSE
 * frames stay identical to the memory driver.
 */
type AnyBullmq = {
  // The bullmq generics are not worth threading through this adapter — it is a
  // thin translation layer between the queue and our JobQueue interface.
  Queue: any;
  Worker: any;
  QueueEvents: any;
};

export async function createBullmqQueue(): Promise<JobQueue> {
  const { Queue, Worker, QueueEvents } = (await import("bullmq")) as unknown as AnyBullmq;
  const connection = { url: env.REDIS_URL };

  const queue = new Queue(env.QUEUE_NAME, { connection });
  const events = new QueueEvents(env.QUEUE_NAME, { connection });
  await events.waitUntilReady();

  const progressListeners = new Map<string, Set<JobReporter>>();
  events.on("progress", ({ jobId, data }: { jobId: string; data: JobProgress }) => {
    const set = progressListeners.get(jobId);
    if (set) for (const listener of set) listener(data);
  });

  let worker: any = null;
  if (env.WORKER_ENABLED) {
    worker = new Worker(
      env.QUEUE_NAME,
      async (job: any) => {
        const handler = getJobHandler(job.name);
        if (!handler) throw new Error(`No job handler registered for "${job.name}"`);
        try {
          return await handler(
            job.data,
            (progress) => {
              void job.updateProgress(progress);
            },
            { jobId: String(job.id) },
          );
        } catch (error) {
          throw new Error(serializeJobError(error));
        }
      },
      { connection },
    );
    worker.on("error", (error: Error) =>
      logger.error({ err: error?.message }, "queue worker error"),
    );
  }

  let closed = false;

  return {
    async enqueue(name, jobId, payload) {
      await queue.add(name, payload, {
        jobId,
        removeOnComplete: true,
        removeOnFail: true,
      });
    },

    async runAndWait<T>(jobId: string, onProgress?: JobReporter): Promise<T> {
      let set = progressListeners.get(jobId);
      if (!set) {
        set = new Set();
        progressListeners.set(jobId, set);
      }
      if (onProgress) set.add(onProgress);

      try {
        const job = await queue.getJob(jobId);
        if (!job) throw new Error(`Job ${jobId} was not found in the queue`);
        const state = await job.getState();
        if (state === "completed") return job.returnvalue as T;
        if (state === "failed") throw deserializeJobError(job.failedReason);
        return (await job.waitUntilFinished(events, JOB_TIMEOUT_MS)) as T;
      } catch (error) {
        // A failed job surfaces as `new Error(failedReason)` where failedReason
        // is our JSON-encoded { message, code }.
        const message = error instanceof Error ? error.message : String(error);
        throw message.trim().startsWith("{") ? deserializeJobError(message) : error;
      } finally {
        progressListeners.delete(jobId);
      }
    },

    async shutdown() {
      if (closed) return;
      closed = true;
      if (worker) await worker.close();
      await events.close();
      await queue.close();
    },
  };
}
