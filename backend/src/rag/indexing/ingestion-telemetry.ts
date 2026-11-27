import type { IngestionRunStatus, IngestionRunType } from "@/db/schema";
import { logger } from "@/shared/logger";
import {
  ingestionRunsStore,
  type IngestionRunInput,
  type IngestionRunsStore,
} from "@/rag/indexing/ingestion-runs-store";

const MAX_ERROR_MESSAGE_LENGTH = 2000;
const DUPLICATE_SETTLE_MESSAGE = "duplicate ingestion run result ignored";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type IngestionRunStart = {
  jobId?: unknown;
  jobType: IngestionRunType;
  projectId?: unknown;
  branch?: unknown;
};

export type IngestionRunCounters = {
  commitsFound?: number;
  commitsWritten?: number;
  commitsEmbedded?: number;
  gitMs?: number;
  dbMs?: number;
  embeddingMs?: number;
  embeddingProvider?: string | null;
  embeddingModel?: string | null;
  embeddingInputTokens?: number | null;
  embeddingOutputTokens?: number | null;
};

export type IngestionRunTracker = {
  finish(counters?: IngestionRunCounters): Promise<void>;
  fail(error: unknown, counters?: IngestionRunCounters): Promise<void>;
};

/**
 * The only telemetry boundary the ingestion handlers touch. Everything about
 * how a run is timed, sanitized, persisted, or how a failure is rendered stays
 * behind this interface.
 */
export interface IngestionTelemetry {
  start(run: IngestionRunStart): IngestionRunTracker;
}

export type IngestionTelemetryDeps = {
  store?: Pick<IngestionRunsStore, "record">;
  /** Wall-clock time, used only for the persisted timestamps. */
  clock?: () => number;
  /** Monotonic time, used for `durationMs` so phases and total share a base. */
  elapsed?: () => number;
  log?: Pick<typeof logger, "warn">;
};

function toUuidOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return UUID_PATTERN.test(trimmed) ? trimmed.toLowerCase() : null;
}

function toBranchOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNonNegativeInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}

const MAX_MODEL_ID_LENGTH = 200;

function toModelIdOrNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MAX_MODEL_ID_LENGTH) : null;
}

function safeString(value: unknown): string | null {
  try {
    return String(value);
  } catch {
    return null;
  }
}

function readCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code.trim()) return code.trim();
  if (typeof code === "number" && Number.isFinite(code)) return String(code);
  return undefined;
}

function readMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
    const rendered = safeString(message);
    if (rendered?.trim()) return rendered;
  }
  if (error instanceof Error && error.name) return error.name;
  return safeString(error);
}

function truncate(message: string): string {
  return message.length > MAX_ERROR_MESSAGE_LENGTH
    ? `${message.slice(0, MAX_ERROR_MESSAGE_LENGTH)}...`
    : message;
}

function describeError(error: unknown): {
  errorCode?: string;
  errorMessage: string;
} {
  const code = readCode(error);
  const message = (readMessage(error) ?? "").trim();
  return {
    ...(code ? { errorCode: code } : {}),
    errorMessage: truncate(message || "Unknown error"),
  };
}

function toRunCounters(
  counters: IngestionRunCounters = {},
): Partial<IngestionRunInput> {
  const result: Partial<IngestionRunInput> = {};

  const commitsFound = toNonNegativeInt(counters.commitsFound);
  if (commitsFound !== undefined) result.commitsFound = commitsFound;

  const commitsWritten = toNonNegativeInt(counters.commitsWritten);
  if (commitsWritten !== undefined) result.commitsWritten = commitsWritten;

  const commitsEmbedded = toNonNegativeInt(counters.commitsEmbedded);
  if (commitsEmbedded !== undefined) result.commitsEmbedded = commitsEmbedded;

  const gitMs = toNonNegativeInt(counters.gitMs);
  if (gitMs !== undefined) result.gitMs = gitMs;

  const dbMs = toNonNegativeInt(counters.dbMs);
  if (dbMs !== undefined) result.dbMs = dbMs;

  const embeddingMs = toNonNegativeInt(counters.embeddingMs);
  if (embeddingMs !== undefined) result.embeddingMs = embeddingMs;

  const embeddingProvider = toModelIdOrNull(counters.embeddingProvider);
  if (embeddingProvider !== undefined) {
    result.embeddingProvider = embeddingProvider;
  }

  const embeddingModel = toModelIdOrNull(counters.embeddingModel);
  if (embeddingModel !== undefined) result.embeddingModel = embeddingModel;

  const embeddingInputTokens = toNonNegativeInt(counters.embeddingInputTokens);
  if (embeddingInputTokens !== undefined) {
    result.embeddingInputTokens = embeddingInputTokens;
  }

  const embeddingOutputTokens = toNonNegativeInt(counters.embeddingOutputTokens);
  if (embeddingOutputTokens !== undefined) {
    result.embeddingOutputTokens = embeddingOutputTokens;
  }

  return result;
}

export function createIngestionTelemetry(
  deps: IngestionTelemetryDeps = {},
): IngestionTelemetry {
  const store = deps.store ?? ingestionRunsStore;
  const clock = deps.clock ?? Date.now;
  const elapsed = deps.elapsed ?? (() => performance.now());
  const log = deps.log ?? logger;

  function currentTime(): number {
    const value = clock();
    return Number.isFinite(value) ? value : Date.now();
  }

  function currentElapsed(): number {
    const value = elapsed();
    return Number.isFinite(value) ? value : performance.now();
  }

  function durationSince(start: number, end: number): number {
    const delta = end - start;
    return Number.isFinite(delta) && delta > 0 ? Math.round(delta) : 0;
  }

  async function persist(input: IngestionRunInput): Promise<void> {
    try {
      await store.record(input);
    } catch (error) {
      log.warn(
        {
          jobId: input.jobId,
          jobType: input.jobType,
          projectId: input.projectId,
          err: describeError(error).errorMessage,
        },
        "ingestion telemetry write failed",
      );
    }
  }

  function start(run: IngestionRunStart): IngestionRunTracker {
    const startedAt = new Date(currentTime());
    const startedElapsed = currentElapsed();
    const base = {
      jobId: toUuidOrNull(run.jobId),
      jobType: run.jobType,
      projectId: toUuidOrNull(run.projectId),
      branch: toBranchOrNull(run.branch),
      startedAt,
    };

    let settled = false;

    async function settle(
      status: IngestionRunStatus,
      counters?: IngestionRunCounters,
      failure?: { value: unknown },
    ): Promise<void> {
      if (settled) {
        log.warn(
          { jobId: base.jobId, jobType: base.jobType },
          DUPLICATE_SETTLE_MESSAGE,
        );
        return;
      }
      settled = true;

      const finishedAt = new Date(currentTime());
      await persist({
        ...base,
        status,
        finishedAt,
        durationMs: durationSince(startedElapsed, currentElapsed()),
        ...toRunCounters(counters),
        ...(failure ? describeError(failure.value) : {}),
      });
    }

    return {
      finish: (counters) => settle("succeeded", counters),
      fail: (error, counters) => settle("failed", counters, { value: error }),
    };
  }

  return { start };
}

export const ingestionTelemetry: IngestionTelemetry =
  createIngestionTelemetry();
