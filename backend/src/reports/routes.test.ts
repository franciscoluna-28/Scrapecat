import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const SCHEDULE_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const mockReportsService = vi.hoisted(() => ({
  listSchedules: vi.fn(),
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  startScheduleRun: vi.fn(),
  listReports: vi.fn(),
  getReport: vi.fn(),
  runDueSchedules: vi.fn(),
  resetInterruptedSchedules: vi.fn(),
}));

vi.mock("@/reports/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/reports/service")>();
  return {
    ...actual,
    reportsService: mockReportsService,
  };
});

import { buildApp } from "@/build-app";

const SCHEDULE = {
  id: SCHEDULE_ID,
  projectId: PROJECT_ID,
  branch: "main",
  cadence: "daily",
  dayOfWeek: 5,
  hourUtc: 9,
  enabled: true,
  nextRunAt: "2026-01-11T09:00:00.000Z",
  lastRunAt: null,
  lastSuccessAt: null,
  lastStatus: "idle",
  lastError: null,
  repositoryName: "repo",
  providerOwner: "owner",
  gitProvider: "github",
  createdAt: "2026-01-10T12:00:00.000Z",
  updatedAt: "2026-01-10T12:00:00.000Z",
};

const REPORT = {
  id: REPORT_ID,
  projectId: PROJECT_ID,
  branch: "main",
  repositoryName: "repo",
  providerOwner: "owner",
  gitProvider: "github",
  summary: "Shipped reports.",
  provider: "openrouter",
  model: "model-x",
  periodStart: "2026-01-03T12:00:00.000Z",
  periodEnd: "2026-01-10T12:00:00.000Z",
  createdAt: "2026-01-10T12:00:00.000Z",
  sourceCommits: [],
};

describe("report routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    for (const mock of Object.values(mockReportsService)) {
      mock.mockReset();
    }
  });

  it("lists schedules", async () => {
    mockReportsService.listSchedules.mockResolvedValue([SCHEDULE]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/report-schedules",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ schedules: [SCHEDULE] });
  });

  it("creates a schedule", async () => {
    mockReportsService.createSchedule.mockResolvedValue(SCHEDULE);

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/report-schedules",
      payload: {
        projectId: PROJECT_ID,
        branch: "main",
        cadence: "daily",
        hourUtc: 9,
      },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual(SCHEDULE);
    expect(mockReportsService.createSchedule).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      branch: "main",
      cadence: "daily",
      dayOfWeek: 5,
      hourUtc: 9,
      enabled: true,
    });
  });

  it("updates a schedule", async () => {
    mockReportsService.updateSchedule.mockResolvedValue(SCHEDULE);

    const res = await app.inject({
      method: "PATCH",
      url: `/api/v1/report-schedules/${SCHEDULE_ID}`,
      payload: { enabled: false },
    });

    expect(res.statusCode).toBe(200);
    expect(mockReportsService.updateSchedule).toHaveBeenCalledWith(
      SCHEDULE_ID,
      { enabled: false },
    );
  });

  it("deletes a schedule", async () => {
    mockReportsService.deleteSchedule.mockResolvedValue(undefined);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/v1/report-schedules/${SCHEDULE_ID}`,
    });

    expect(res.statusCode).toBe(204);
  });

  it("runs a schedule manually", async () => {
    mockReportsService.startScheduleRun.mockResolvedValue({
      scheduleId: SCHEDULE_ID,
      status: "running",
    });

    const res = await app.inject({
      method: "POST",
      url: `/api/v1/report-schedules/${SCHEDULE_ID}/run`,
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({
      scheduleId: SCHEDULE_ID,
      status: "running",
    });
  });

  it("lists reports", async () => {
    mockReportsService.listReports.mockResolvedValue([REPORT]);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/reports?projectId=${PROJECT_ID}&branch=main&limit=10`,
    });

    const { sourceCommits: _sourceCommits, ...summary } = REPORT;
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ reports: [summary] });
    expect(mockReportsService.listReports).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      branch: "main",
      limit: 10,
    });
  });

  it("gets a report with source commits", async () => {
    mockReportsService.getReport.mockResolvedValue(REPORT);

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/reports/${REPORT_ID}`,
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(REPORT);
  });

  it("maps a missing report to 404", async () => {
    mockReportsService.getReport.mockRejectedValue(
      new Error("Report not found"),
    );

    const res = await app.inject({
      method: "GET",
      url: `/api/v1/reports/${REPORT_ID}`,
    });

    expect(res.statusCode).toBe(404);
  });

  it("publishes the reports API in the OpenAPI document", () => {
    const spec = (
      app as unknown as {
        swagger: () => { paths: Record<string, unknown> };
      }
    ).swagger();

    expect(spec.paths["/api/v1/report-schedules"]).toBeDefined();
    expect(spec.paths["/api/v1/report-schedules/{id}"]).toBeDefined();
    expect(spec.paths["/api/v1/report-schedules/{id}/run"]).toBeDefined();
    expect(spec.paths["/api/v1/reports"]).toBeDefined();
    expect(spec.paths["/api/v1/reports/{id}"]).toBeDefined();
  });
});
