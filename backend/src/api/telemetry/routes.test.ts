import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mockTelemetryService = vi.hoisted(() => ({
  listIngestionRuns: vi.fn(),
}));

vi.mock("@/api/telemetry/service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/api/telemetry/service")>();
  return {
    ...actual,
    telemetryService: mockTelemetryService,
  };
});

import { buildApp } from "@/build-app";

const SUMMARY = {
  windowDays: 7,
  runs: 0,
  failedRuns: 0,
  commitsProcessed: 0,
  embeddingsProcessed: 0,
  avgDurationMs: null,
  embeddingInputTokens: null,
  embeddingOutputTokens: null,
};

describe("telemetry routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockTelemetryService.listIngestionRuns.mockReset();
    mockTelemetryService.listIngestionRuns.mockResolvedValue({
      summary: SUMMARY,
      runs: [],
    });
  });

  it("returns the recent runs payload with query defaults", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/telemetry/ingestion-runs",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ summary: SUMMARY, runs: [] });
    expect(mockTelemetryService.listIngestionRuns).toHaveBeenCalledWith({
      limit: 8,
      windowDays: 7,
      projectId: undefined,
      jobType: undefined,
    });
  });

  it("forwards limit, window, project, and job type", async () => {
    const projectId = "22222222-2222-4222-8222-222222222222";

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/telemetry/ingestion-runs?limit=3&windowDays=30&projectId=${projectId}&jobType=reindex-embeddings`,
    });

    expect(res.statusCode).toBe(200);
    expect(mockTelemetryService.listIngestionRuns).toHaveBeenCalledWith({
      limit: 3,
      windowDays: 30,
      projectId,
      jobType: "reindex-embeddings",
    });
  });

  it.each([
    "limit=0",
    "limit=51",
    "windowDays=0",
    "windowDays=91",
    "projectId=not-a-uuid",
    "jobType=unknown",
  ])("rejects invalid query %s", async (query) => {
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/telemetry/ingestion-runs?${query}`,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: expect.any(String) });
    expect(mockTelemetryService.listIngestionRuns).not.toHaveBeenCalled();
  });
});
