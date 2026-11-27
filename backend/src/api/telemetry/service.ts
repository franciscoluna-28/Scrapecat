import type {
  GitProvider,
  IngestionRunStatus,
  IngestionRunType,
} from "@/db/schema";
import {
  ingestionRunsStore,
  type IngestionRunSummary,
  type IngestionRunView,
  type IngestionRunsStore,
} from "@/rag/indexing/ingestion-runs-store";

const DAY_MS = 86_400_000;

export type IngestionRunDTO = {
  id: string;
  jobType: IngestionRunType;
  status: IngestionRunStatus;
  projectId: string | null;
  branch: string | null;
  repositoryName: string | null;
  providerOwner: string | null;
  gitProvider: GitProvider | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  gitMs: number | null;
  dbMs: number | null;
  embeddingMs: number | null;
  commitsFound: number | null;
  commitsWritten: number | null;
  commitsEmbedded: number | null;
  embeddingProvider: string | null;
  embeddingModel: string | null;
  embeddingInputTokens: number | null;
  embeddingOutputTokens: number | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export type IngestionRunSummaryDTO = IngestionRunSummary & {
  windowDays: number;
};

export type TelemetryServiceDeps = {
  store: Pick<IngestionRunsStore, "listRecent" | "summarizeSince">;
  now: () => Date;
};

function toRunDTO(row: IngestionRunView): IngestionRunDTO {
  return {
    id: row.id,
    jobType: row.jobType,
    status: row.status,
    projectId: row.projectId,
    branch: row.branch,
    repositoryName: row.repositoryName,
    providerOwner: row.providerOwner,
    gitProvider: row.gitProvider,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt.toISOString(),
    durationMs: row.durationMs,
    gitMs: row.gitMs,
    dbMs: row.dbMs,
    embeddingMs: row.embeddingMs,
    commitsFound: row.commitsFound,
    commitsWritten: row.commitsWritten,
    commitsEmbedded: row.commitsEmbedded,
    embeddingProvider: row.embeddingProvider,
    embeddingModel: row.embeddingModel,
    embeddingInputTokens: row.embeddingInputTokens,
    embeddingOutputTokens: row.embeddingOutputTokens,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
  };
}

export function createTelemetryService(
  overrides: Partial<TelemetryServiceDeps> = {},
) {
  const deps: TelemetryServiceDeps = {
    store: ingestionRunsStore,
    now: () => new Date(),
    ...overrides,
  };

  async function listIngestionRuns(input: {
    limit: number;
    windowDays: number;
    projectId?: string;
    jobType?: IngestionRunType;
  }): Promise<{ summary: IngestionRunSummaryDTO; runs: IngestionRunDTO[] }> {
    const since = new Date(
      deps.now().getTime() - input.windowDays * DAY_MS,
    );
    const filters = {
      projectId: input.projectId,
      jobType: input.jobType,
    };

    const [runs, summary] = await Promise.all([
      deps.store.listRecent({ limit: input.limit, ...filters }),
      deps.store.summarizeSince({ since, ...filters }),
    ]);

    return {
      summary: {
        windowDays: input.windowDays,
        ...summary,
        avgDurationMs:
          summary.avgDurationMs === null
            ? null
            : Math.round(summary.avgDurationMs),
      },
      runs: runs.map(toRunDTO),
    };
  }

  return { listIngestionRuns };
}

export const telemetryService = createTelemetryService();
