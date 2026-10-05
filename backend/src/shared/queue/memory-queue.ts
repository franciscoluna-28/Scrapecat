import { getJobHandler } from "./registry";
import type { JobProgress, JobQueue, JobReporter } from "./job-queue";

/**
 * Default queue: runs the handler inline from `runAndWait`. Timing and
 * callbacks match the pre-queue code exactly, and it needs no Redis — so dev,
 * tests, and the serverless demo stay infra-free.
 *
 * `enqueue` only records the job; `runAndWait` executes it. That ordering
 * guarantees the caller's `onProgress` is attached before the first progress
 * event fires (no lost frames).
 */
export function createMemoryQueue(): JobQueue {
  const pending = new Map<string, { name: string; payload: unknown }>();
  const active = new Map<string, Promise<unknown>>();
  const listeners = new Map<string, Set<JobReporter>>();

  async function execute(jobId: string, name: string, payload: unknown): Promise<unknown> {
    const handler = getJobHandler(name);
    if (!handler) throw new Error(`No job handler registered for "${name}"`);
    const report: JobReporter = (progress: JobProgress) => {
      for (const listener of listeners.get(jobId) ?? []) listener(progress);
    };
    return handler(payload, report, { jobId });
  }

  return {
    async enqueue(name, jobId, payload) {
      if (pending.has(jobId) || active.has(jobId)) return; // dedupe
      pending.set(jobId, { name, payload });
    },

    runAndWait<T>(jobId: string, onProgress?: JobReporter): Promise<T> {
      if (onProgress) {
        let set = listeners.get(jobId);
        if (!set) {
          set = new Set();
          listeners.set(jobId, set);
        }
        set.add(onProgress);
      }

      const existing = active.get(jobId);
      if (existing) return existing as Promise<T>;

      const job = pending.get(jobId);
      if (!job) {
        return Promise.reject(new Error(`Job ${jobId} was not enqueued`));
      }
      pending.delete(jobId);

      const promise = execute(jobId, job.name, job.payload).finally(() => {
        active.delete(jobId);
        listeners.delete(jobId);
      });
      active.set(jobId, promise);
      return promise as Promise<T>;
    },

    async shutdown() {
      pending.clear();
    },
  };
}
