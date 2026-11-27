import { describe, expect, it, vi } from "vitest";
import type {
  IngestionRunSummary,
  IngestionRunView,
} from "@/rag/indexing/ingestion-runs-store";
import { createTelemetryService } from "@/api/telemetry/service";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-03-10T00:00:00.000Z");

function run(overrides: Partial<IngestionRunView> = {}): IngestionRunView {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    jobId: null,
    jobType: "ingest-branch",
    projectId: PROJECT_ID,
    branch: "main",
    status: "succeeded",
    startedAt: new Date("2026-03-09T10:00:00.000Z"),
    finishedAt: new Date("2026-03-09T10:00:01.200Z"),
    durationMs: 1200,
    gitMs: 900,
    dbMs: 100,
    embeddingMs: 800,
    commitsFound: 3,
    commitsWritten: 3,
    commitsEmbedded: 2,
    embeddingProvider: "openrouter",
    embeddingModel: "openai/text-embedding-3-small",
    embeddingInputTokens: 4200,
    embeddingOutputTokens: 0,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date("2026-03-09T10:00:01.200Z"),
    repositoryName: "repo",
    providerOwner: "owner",
    gitProvider: "github",
    ...overrides,
  };
}

const DEFAULT_SUMMARY: IngestionRunSummary = {
  runs: 0,
  failedRuns: 0,
  commitsProcessed: 0,
  embeddingsProcessed: 0,
  avgDurationMs: null,
  embeddingInputTokens: null,
  embeddingOutputTokens: null,
};

function setup(
  rows: IngestionRunView[],
  summary: Partial<IngestionRunSummary> = {},
) {
  const listRecent = vi.fn(async () => rows);
  const summarizeSince = vi.fn(async () => ({
    ...DEFAULT_SUMMARY,
    ...summary,
  }));
  const service = createTelemetryService({
    store: { listRecent, summarizeSince },
    now: () => NOW,
  });
  return { service, listRecent, summarizeSince };
}

describe("telemetryService.listIngestionRuns", () => {
  it("maps a run and summarizes the window", async () => {
    const { service, listRecent, summarizeSince } = setup([run()], {
      runs: 4,
      failedRuns: 1,
      commitsProcessed: 12,
      embeddingsProcessed: 9,
      avgDurationMs: 1234.6,
      embeddingInputTokens: 9000,
      embeddingOutputTokens: 120,
    });

    const result = await service.listIngestionRuns({
      limit: 8,
      windowDays: 7,
    });

    expect(listRecent).toHaveBeenCalledWith({ limit: 8 });
    expect(summarizeSince).toHaveBeenCalledWith({
      since: new Date("2026-03-03T00:00:00.000Z"),
    });
    expect(result.summary).toEqual({
      windowDays: 7,
      runs: 4,
      failedRuns: 1,
      commitsProcessed: 12,
      embeddingsProcessed: 9,
      avgDurationMs: 1235,
      embeddingInputTokens: 9000,
      embeddingOutputTokens: 120,
    });
    expect(result.runs[0]).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      jobType: "ingest-branch",
      status: "succeeded",
      projectId: PROJECT_ID,
      branch: "main",
      repositoryName: "repo",
      providerOwner: "owner",
      gitProvider: "github",
      startedAt: "2026-03-09T10:00:00.000Z",
      finishedAt: "2026-03-09T10:00:01.200Z",
      durationMs: 1200,
      gitMs: 900,
      dbMs: 100,
      embeddingMs: 800,
      commitsFound: 3,
      commitsWritten: 3,
      commitsEmbedded: 2,
      embeddingProvider: "openrouter",
      embeddingModel: "openai/text-embedding-3-small",
      embeddingInputTokens: 4200,
    embeddingOutputTokens: 0,
      errorCode: null,
      errorMessage: null,
    });
  });

  it("keeps the reindex row distinguishable with null project fields", async () => {
    const { service } = setup(
      [
        run({
          jobType: "reindex-embeddings",
          status: "failed",
          gitMs: null,
          dbMs: 5,
          projectId: null,
          branch: null,
          repositoryName: null,
          providerOwner: null,
          gitProvider: null,
          commitsFound: null,
          commitsWritten: null,
          commitsEmbedded: null,
          embeddingInputTokens: null,
  embeddingOutputTokens: null,
          errorCode: "EmbeddingError",
          errorMessage: "provider down",
        }),
      ],
      { avgDurationMs: null, embeddingInputTokens: null, embeddingOutputTokens: null },
    );

    const result = await service.listIngestionRuns({
      limit: 8,
      windowDays: 30,
    });

    expect(result.summary.avgDurationMs).toBeNull();
    expect(result.summary.embeddingInputTokens).toBeNull();
    expect(result.summary.embeddingOutputTokens).toBeNull();
    expect(result.runs[0]).toMatchObject({
      jobType: "reindex-embeddings",
      status: "failed",
      projectId: null,
      branch: null,
      repositoryName: null,
      embeddingInputTokens: null,
  embeddingOutputTokens: null,
      errorCode: "EmbeddingError",
      errorMessage: "provider down",
    });
  });

  it("forwards project and job type filters to both queries", async () => {
    const { service, listRecent, summarizeSince } = setup([]);

    await service.listIngestionRuns({
      limit: 5,
      windowDays: 7,
      projectId: PROJECT_ID,
      jobType: "ingest-branch",
    });

    expect(listRecent).toHaveBeenCalledWith({
      limit: 5,
      projectId: PROJECT_ID,
      jobType: "ingest-branch",
    });
    expect(summarizeSince).toHaveBeenCalledWith({
      since: new Date("2026-03-03T00:00:00.000Z"),
      projectId: PROJECT_ID,
      jobType: "ingest-branch",
    });
  });

  it("returns an empty feed without inventing an average", async () => {
    const { service } = setup([]);

    const result = await service.listIngestionRuns({
      limit: 8,
      windowDays: 7,
    });

    expect(result.runs).toEqual([]);
    expect(result.summary).toEqual({ windowDays: 7, ...DEFAULT_SUMMARY });
  });
});
