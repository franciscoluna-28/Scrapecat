import { randomUUID } from "crypto";
import { logger } from "@/shared/logger";
import { timed } from "@/shared/timing";
import { getProviderConfig } from "@/shared/integrations/providers/registry";
import { getAISettings } from "@/settings/services";
import { resolveApiKey } from "@/credentials/services";
import { env } from "@/config/env";
import {
  createReportUseCase,
  NoCommitsError,
  AIGenerationError,
  ProviderKeyError,
  type CreateReportInput,
} from "@/reports/use-cases";

export type ReportJobStatus = "queued" | "running" | "succeeded" | "failed";

export type ReportJob = {
  id: string;
  status: ReportJobStatus;
  input: CreateReportInput;
  reportId: string | null;
  projectId: string | null;
  error: { message: string; status: number } | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
};

const jobs = new Map<string, ReportJob>();
const queue: string[] = [];
let active = 0;
const CONCURRENCY = 1;

function createJobRecord(input: CreateReportInput): ReportJob {
  return {
    id: randomUUID(),
    status: "queued",
    input,
    reportId: null,
    projectId: null,
    error: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  };
}

function mapJobError(error: unknown): { message: string; status: number } {
  if (error instanceof NoCommitsError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof ProviderKeyError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof AIGenerationError) {
    return { message: error.message, status: error.status };
  }
  const status =
    (error as any)?.status === 404 ||
    (error as any)?.status === 422 ||
    (error as any)?.code === "NotFoundError"
      ? 400
      : 500;
  const message =
    status === 400
      ? "Branch or repository not found on GitHub. Check the branch name and repository access."
      : "Report generation failed. Please try again.";
  return { message, status };
}

async function runJob(jobId: string) {
  const job = jobs.get(jobId);
  if (!job) return;
  job.status = "running";
  job.startedAt = new Date().toISOString();

  try {
    const { reportId, projectId } = await timed(
      "job.createReport",
      { jobId, repo: job.input.repository, branch: job.input.branch },
      () => createReportUseCase(job.input),
    );
    job.reportId = reportId;
    job.projectId = projectId;
    job.status = "succeeded";
  } catch (error) {
    job.error = mapJobError(error);
    job.status = "failed";
    logger.error(
      { jobId, err: (error as Error)?.message ?? String(error) },
      "report job failed",
    );
  } finally {
    job.finishedAt = new Date().toISOString();
    active -= 1;
    void drainQueue();
  }
}

async function drainQueue() {
  while (active < CONCURRENCY && queue.length > 0) {
    const jobId = queue.shift();
    if (!jobId) return;
    active += 1;
    void runJob(jobId);
  }
}

/**
 * Validates the AI provider/key synchronously with the report use case
 * (fail fast with a 400 before queueing a doomed job), then enqueues the
 * report and returns the job. The worker runs the pipeline in the background.
 */
export async function enqueueReportJob(input: CreateReportInput): Promise<ReportJob> {
  const settings = await getAISettings();
  const provider = input.provider || settings.reportProvider;
  const providerConfig = getProviderConfig(provider);
  if (!providerConfig) {
    throw new ProviderKeyError(provider);
  }
  const storedKey = await resolveApiKey(provider);
  const apiKey =
    storedKey ||
    (env as unknown as Record<string, string>)[providerConfig.envKey] ||
    "";
  if (!apiKey) {
    throw new ProviderKeyError(provider);
  }

  const job = createJobRecord(input);
  jobs.set(job.id, job);
  queue.push(job.id);
  void drainQueue();

  logger.info(
    { jobId: job.id, repo: input.repository, branch: input.branch, queueLength: queue.length },
    "report job queued",
  );
  return job;
}

export function getReportJob(jobId: string): ReportJob | null {
  return jobs.get(jobId) ?? null;
}
