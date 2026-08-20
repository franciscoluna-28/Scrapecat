import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import { ProviderKeyError } from "@/reports/use-cases";

const mockEnqueueReportJob = vi.fn();
const mockGetReportJob = vi.fn();

vi.mock("@/reports/jobs", () => ({
  enqueueReportJob: (...args: unknown[]) => mockEnqueueReportJob(...args),
  getReportJob: (...args: unknown[]) => mockGetReportJob(...args),
}));

import { buildApp } from "@/app";

const validData = {
  repository: "repo",
  gitProvider: "github",
  providerProjectId: "1",
  providerOwner: "o",
  branch: "main",
  startDate: "2024-01-01",
  endDate: "2024-01-31",
};

describe("POST /api/v1/reports (async)", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockEnqueueReportJob.mockReset();
  });

  it("returns 202 with a job id", async () => {
    mockEnqueueReportJob.mockResolvedValue({ id: "job-1", status: "queued" });

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/reports",
      payload: { data: validData },
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ jobId: "job-1", status: "queued" });
  });

  it("returns 400 when the provider key is missing", async () => {
    mockEnqueueReportJob.mockRejectedValue(new ProviderKeyError("openrouter"));

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/reports",
      payload: { data: validData },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain("No API key");
  });

  it("rejects invalid input before queueing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/reports",
      payload: { data: { repository: "r" } },
    });

    expect(res.statusCode).toBe(400);
    expect(mockEnqueueReportJob).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/reports/jobs/:jobId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the job status", async () => {
    mockGetReportJob.mockReturnValue({
      id: "job-1",
      status: "succeeded",
      reportId: "report-1",
      projectId: "proj-1",
      error: null,
      createdAt: "2024-01-01T00:00:00.000Z",
      startedAt: "2024-01-01T00:00:00.000Z",
      finishedAt: "2024-01-01T00:01:00.000Z",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/jobs/job-1",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      jobId: "job-1",
      status: "succeeded",
      reportId: "report-1",
    });
  });

  it("returns 404 for an unknown job", async () => {
    mockGetReportJob.mockReturnValue(null);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/reports/jobs/nope",
    });

    expect(res.statusCode).toBe(404);
  });
});
