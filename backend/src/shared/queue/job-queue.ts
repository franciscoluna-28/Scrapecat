import type { JobProgress } from "@/db/schema";

export type { JobProgress };

export type JobReporter = (progress: JobProgress) => void;

export type JobContext = {
  jobId: string;
};

export type JobHandler = (
  payload: unknown,
  report: JobReporter,
  ctx: JobContext,
) => Promise<unknown>;
