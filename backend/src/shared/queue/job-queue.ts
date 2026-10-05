/**
 * Minimal in-process job abstraction. A job is identified by a caller-chosen
 * `jobId`, which also acts as the dedupe key: enqueuing an id that is already
 * pending/active attaches to it instead of starting a second run.
 */
export type JobProgress = {
  stage: string;
  message: string;
  done?: number;
  total?: number;
};

export type JobReporter = (progress: JobProgress) => void;

export type JobContext = {
  jobId: string;
};

export type JobHandler = (
  payload: unknown,
  report: JobReporter,
  ctx: JobContext,
) => Promise<unknown>;

export interface JobQueue {
  /** Adds a job, deduping against a pending/active job with the same id. */
  enqueue(name: string, jobId: string, payload: unknown): Promise<void>;

  /**
   * Waits for the job's result. When the job is already active, attaches to it
   * (progress emitted from then on is forwarded to `onProgress`).
   */
  runAndWait<T>(jobId: string, onProgress?: JobReporter): Promise<T>;

  /** Releases worker/queue resources. Idempotent. */
  shutdown(): Promise<void>;
}
