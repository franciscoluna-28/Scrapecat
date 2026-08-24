import { randomUUID } from "crypto";
import { EventEmitter } from "events";
import { logger } from "@/shared/logger";
import { getProviderConfig } from "@/shared/integrations/providers/registry";
import { getAISettings } from "@/settings/services";
import { resolveApiKey } from "@/credentials/services";
import { env } from "@/config/env";
import {
  ingestReportWindow,
  generateReportUseCase,
  NoCommitsError,
  AIGenerationError,
  ProviderKeyError,
  type CreateReportInput,
} from "@/reports/use-cases";
import * as jobStore from "@/reports/stores/job-store";
import type { ReportJobRow } from "@/reports/stores/job-store";

/**
 * Minimal in-process FIFO queue. Postgres (`report_jobs`) is the durable
 * status store; this just sequences the single worker. No external infra.
 */
const queue: string[] = [];
let active = 0;
const CONCURRENCY = 1;

/** Emits every persisted job transition so SSE streams can push live updates. */
export const jobEvents = new EventEmitter();

function emit(job: ReportJobRow) {
  jobEvents.emit(job.id, job);
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
  if ((error as any)?.code === "BranchNotFound") {
    return {
      message: "Branch not found in this repository. Check the branch name.",
      status: 400,
    };
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

/**
 * Phase 1 ingests the window (clone + git walk + chunks + embedding) — the
 * memory-heavy part. Phase 2 generates the report (AI + DB only) and only runs
 * after phase 1 succeeds, so the frontend can gate on `commitCount` first.
 */
async function runJob(jobId: string) {
  const job = await jobStore.updateJob(jobId, {
    status: "running",
    phase: "ingestion",
    startedAt: new Date(),
  });
  if (!job) return;
  emit(job);

  const progress = (stage: string, message: string, done?: number) => {
    void jobStore
      .updateJobProgress(jobId, {
        ...(stage === "commits" && done !== undefined ? { commitCount: done } : {}),
        progress: message,
      })
      .then((updated) => {
        if (updated) emit(updated);
      });
  };

  try {
    const { projectId, ingestResult } = await ingestReportWindow(job.data, progress);

    let updated = await jobStore.updateJob(jobId, {
      phase: "generation",
      projectId,
      commitCount: ingestResult.commitsFound,
      progress: "Generating report...",
    });
    if (updated) emit(updated);

    const { reportId } = await generateReportUseCase(job.data, projectId);

    updated = await jobStore.updateJob(jobId, {
      status: "succeeded",
      reportId,
      progress: null,
      finishedAt: new Date(),
    });
    if (updated) emit(updated);
  } catch (error) {
    const errorInfo = mapJobError(error);
    const updated = await jobStore.updateJob(jobId, {
      status: "failed",
      error: errorInfo,
      progress: null,
      finishedAt: new Date(),
    });
    if (updated) emit(updated);
    logger.error(
      { jobId, err: (error as Error)?.message ?? String(error) },
      "report job failed",
    );
  } finally {
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
 * report and returns the persisted job. The worker runs both phases in the
 * background.
 */
export async function enqueueReportJob(input: CreateReportInput): Promise<ReportJobRow> {
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

  const job = await jobStore.createJob({ id: randomUUID(), data: input });
  queue.push(job.id);
  void drainQueue();

  logger.info(
    { jobId: job.id, repo: input.repository, branch: input.branch, queueLength: queue.length },
    "report job queued",
  );
  return job;
}

export function getReportJob(jobId: string): Promise<ReportJobRow | null> {
  return jobStore.getJob(jobId);
}

/** Marks jobs interrupted by a restart as failed so they never hang the UI. */
export async function initJobs() {
  const failed = await jobStore.failOrphanedJobs();
  if (failed > 0) {
    logger.info({ failed }, "failed orphaned report jobs on boot");
  }
}
