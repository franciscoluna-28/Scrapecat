export type {
  JobContext,
  JobHandler,
  JobProgress,
  JobReporter,
} from "./job-queue";

export { registerJobHandler, resetJobHandlers } from "./registry";
export { enqueueJob, getJob, waitForJob } from "./job-store";
export { runJobInline, startJobWorker, stopJobWorker } from "./worker";

import { stopJobWorker } from "./worker";

export async function shutdownJobs(): Promise<void> {
  await stopJobWorker();
}
