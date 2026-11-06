import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/src/shared/services/keys";

const mocks = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/src/shared/api/client", () => ({
  apiClient: {
    GET: mocks.GET,
    POST: mocks.POST,
    PATCH: mocks.PATCH,
    DELETE: mocks.DELETE,
  },
  unwrap: async (request: Promise<{ data?: unknown; error?: unknown }>) => {
    const result = await request;
    if (result.error) throw result.error;
    return result.data;
  },
  errorMessage: (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback,
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import {
  useCreateReportSchedule,
  useDeleteReportSchedule,
  useReport,
  useReports,
  useReportSchedules,
  useRunReportSchedule,
  useUpdateReportSchedule,
  type ReportDetail,
  type ReportSchedule,
  type ReportSummary,
} from "./reports-api";

const SCHEDULE_ID = "11111111-1111-4111-8111-111111111111";
const REPORT_ID = "33333333-3333-4333-8333-333333333333";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

function schedule(): ReportSchedule {
  return {
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
}

function report(): ReportSummary {
  return {
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
  };
}

function reportDetail(): ReportDetail {
  return {
    ...report(),
    sourceCommits: [
      {
        commitSha: "abc123",
        commitMessage: "feat: ship reports",
        author: "dev",
        committedAt: "2026-01-09T10:00:00.000Z",
        filesChanged: ["src/reports.ts"],
        commitUrl: "https://github.com/owner/repo/commit/abc123",
      },
    ],
  };
}

let queryClient: QueryClient;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) {
    mock.mockReset();
  }
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe("report queries", () => {
  it("loads schedules", async () => {
    const item = schedule();
    mocks.GET.mockResolvedValue({ data: { schedules: [item] } });

    const { result } = renderHook(() => useReportSchedules(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.schedules).toEqual([item]));
    expect(mocks.GET).toHaveBeenCalledWith("/api/v1/report-schedules");
  });

  it("loads reports with a limit", async () => {
    const item = report();
    mocks.GET.mockResolvedValue({ data: { reports: [item] } });

    const { result } = renderHook(() => useReports(10), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.reports).toEqual([item]));
    expect(mocks.GET).toHaveBeenCalledWith("/api/v1/reports", {
      params: { query: { limit: 10 } },
    });
  });

  it("loads a report detail only when selected", async () => {
    const detail = reportDetail();
    mocks.GET.mockResolvedValue({ data: detail });

    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useReport(id),
      {
        wrapper: createWrapper(),
        initialProps: { id: null as string | null },
      },
    );

    expect(result.current.report).toBeNull();
    expect(mocks.GET).not.toHaveBeenCalled();

    rerender({ id: REPORT_ID });
    await waitFor(() => expect(result.current.report).toEqual(detail));
    expect(mocks.GET).toHaveBeenCalledWith("/api/v1/reports/{id}", {
      params: { path: { id: REPORT_ID } },
    });
  });
});

describe("report mutations", () => {
  it("creates a schedule and invalidates schedules", async () => {
    mocks.POST.mockResolvedValue({ data: schedule() });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateReportSchedule(), {
      wrapper: createWrapper(),
    });

    const input = {
      projectId: PROJECT_ID,
      branch: "main",
      cadence: "daily" as const,
      dayOfWeek: 5,
      hourUtc: 9,
      enabled: true,
    };

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(mocks.POST).toHaveBeenCalledWith("/api/v1/report-schedules", {
      body: input,
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: queryKeys.reportSchedules.all,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Schedule created");
  });

  it("updates a schedule", async () => {
    mocks.PATCH.mockResolvedValue({ data: schedule() });

    const { result } = renderHook(() => useUpdateReportSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        id: SCHEDULE_ID,
        schedule: { enabled: false },
      });
    });

    expect(mocks.PATCH).toHaveBeenCalledWith(
      "/api/v1/report-schedules/{id}",
      {
        params: { path: { id: SCHEDULE_ID } },
        body: { enabled: false },
      },
    );
  });

  it("deletes a schedule", async () => {
    mocks.DELETE.mockResolvedValue({ data: undefined });

    const { result } = renderHook(() => useDeleteReportSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(SCHEDULE_ID);
    });

    expect(mocks.DELETE).toHaveBeenCalledWith(
      "/api/v1/report-schedules/{id}",
      { params: { path: { id: SCHEDULE_ID } } },
    );
  });

  it("runs a schedule manually", async () => {
    mocks.POST.mockResolvedValue({
      data: { scheduleId: SCHEDULE_ID, status: "running" },
    });

    const { result } = renderHook(() => useRunReportSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync(SCHEDULE_ID);
    });

    expect(mocks.POST).toHaveBeenCalledWith(
      "/api/v1/report-schedules/{id}/run",
      { params: { path: { id: SCHEDULE_ID } } },
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Summary run started");
  });

  it("surfaces mutation errors", async () => {
    mocks.DELETE.mockResolvedValue({
      error: new Error("Schedule not found"),
    });

    const { result } = renderHook(() => useDeleteReportSchedule(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(SCHEDULE_ID)).rejects.toThrow(
        "Schedule not found",
      );
    });

    expect(mocks.toastError).toHaveBeenCalledWith("Schedule not found");
  });
});
