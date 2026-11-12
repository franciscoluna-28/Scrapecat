import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createReportsService,
  REPORT_ERROR_MESSAGES,
} from "@/api/reports/service";
import type { ReportScheduleRow } from "@/db/schema";

const NOW = new Date("2026-01-10T12:00:00.000Z");
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const SCHEDULE_ID = "11111111-1111-4111-8111-111111111111";

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    gitProvider: "github",
    providerProjectId: "1",
    providerOwner: "owner",
    repositoryName: "repo",
    defaultBranch: "main",
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeScheduleRow(
  overrides: Partial<ReportScheduleRow> = {},
): ReportScheduleRow {
  return {
    id: SCHEDULE_ID,
    projectId: PROJECT_ID,
    branch: "main",
    cadence: "daily",
    dayOfWeek: 5,
    hour: 9,
    timezone: "UTC",
    enabled: true,
    nextRunAt: NOW,
    lastRunAt: null,
    lastSuccessAt: null,
    lastStatus: "idle",
    lastError: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeScheduleView(row: ReportScheduleRow) {
  return {
    ...row,
    repositoryName: "repo",
    providerOwner: "owner",
    gitProvider: "github" as const,
  };
}

function makeCommitRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "commit-1",
    projectId: PROJECT_ID,
    commitSha: "abc123",
    branch: "main",
    commitMessage: "feat: ship reports",
    author: "dev",
    embedding: null,
    embeddingProvider: null,
    embeddingModel: null,
    contentHash: null,
    embeddingHash: null,
    metadata: {
      filesChanged: ["src/reports/service.ts"],
      commitUrl: "https://github.com/owner/repo/commit/abc123",
    },
    committedAt: new Date("2026-01-09T10:00:00.000Z"),
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeService() {
  const store = {
    listSchedules: vi.fn(),
    getSchedule: vi.fn(),
    getScheduleView: vi.fn(),
    getScheduleByProjectBranch: vi.fn(),
    createSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    listDueSchedules: vi.fn(),
    claimSchedule: vi.fn(),
    markScheduleRunning: vi.fn(),
    markScheduleSucceeded: vi.fn(),
    markScheduleFailed: vi.fn(),
    markInterruptedSchedulesFailed: vi.fn(),
    createReport: vi.fn(),
    listReports: vi.fn(),
    getReport: vi.fn(),
  };
  const projects = { getProjectById: vi.fn() };
  const commits = { listCommitsForProject: vi.fn() };
  const ai = { generate: vi.fn() };
  const resolveModel = vi.fn();
  const prepareBranch = vi.fn();
  const branchExists = vi.fn();

  const service = createReportsService({
    store: store as never,
    projects: projects as never,
    commits: commits as never,
    ai: ai as never,
    resolveModel: resolveModel as never,
    prepareBranch: prepareBranch as never,
    branchExists,
    now: () => NOW,
  });

  return {
    service,
    store,
    projects,
    commits,
    ai,
    resolveModel,
    prepareBranch,
    branchExists,
  };
}

function makeStatefulService(
  initialSchedule: ReportScheduleRow,
  initialNow: Date,
) {
  let now = initialNow;
  let schedule = { ...initialSchedule };
  const reports: Array<Record<string, unknown>> = [];

  const store = {
    getSchedule: vi.fn(async () => ({ ...schedule })),
    listDueSchedules: vi.fn(async (at: Date) =>
      schedule.enabled &&
      schedule.nextRunAt.getTime() <= at.getTime() &&
      schedule.lastStatus !== "running"
        ? [{ ...schedule }]
        : [],
    ),
    claimSchedule: vi.fn(
      async (input: { id: string; nextRunAt: Date; now: Date }) => {
        if (
          schedule.nextRunAt.getTime() > input.now.getTime() ||
          schedule.lastStatus === "running"
        ) {
          return null;
        }
        schedule = {
          ...schedule,
          nextRunAt: input.nextRunAt,
          lastRunAt: input.now,
          lastStatus: "running",
          lastError: null,
          updatedAt: input.now,
        };
        return { ...schedule };
      },
    ),
    markScheduleRunning: vi.fn(
      async (input: { id: string; now: Date; nextRunAt?: Date }) => {
        if (schedule.lastStatus === "running") return null;
        schedule = {
          ...schedule,
          ...(input.nextRunAt ? { nextRunAt: input.nextRunAt } : {}),
          lastRunAt: input.now,
          lastStatus: "running",
          lastError: null,
          updatedAt: input.now,
        };
        return { ...schedule };
      },
    ),
    markScheduleSucceeded: vi.fn(
      async (input: { id: string; periodEnd: Date; now: Date }) => {
        schedule = {
          ...schedule,
          lastStatus: "succeeded",
          lastSuccessAt: input.periodEnd,
          lastError: null,
          updatedAt: input.now,
        };
      },
    ),
    markScheduleFailed: vi.fn(
      async (input: { id: string; error: string; now: Date }) => {
        schedule = {
          ...schedule,
          lastStatus: "failed",
          lastError: input.error,
          updatedAt: input.now,
        };
      },
    ),
    createReport: vi.fn(async (input: Record<string, unknown>) => {
      reports.push(input);
      return input;
    }),
  };

  const service = createReportsService({
    store: store as never,
    projects: {
      getProjectById: vi.fn(async () => makeProject()),
    } as never,
    commits: {
      listCommitsForProject: vi.fn(async () => []),
    } as never,
    ai: { generate: vi.fn() } as never,
    resolveModel: vi.fn() as never,
    prepareBranch: vi.fn(async () => ({ branch: "main" })) as never,
    branchExists: vi.fn(async () => true),
    now: () => now,
  });

  return {
    service,
    reports,
    getSchedule: () => schedule,
    setNow: (value: Date) => {
      now = value;
    },
  };
}

describe("createReportsService", () => {
  let deps: ReturnType<typeof makeService>;

  beforeEach(() => {
    deps = makeService();
    deps.projects.getProjectById.mockResolvedValue(makeProject());
    deps.branchExists.mockResolvedValue(true);
    deps.store.getScheduleByProjectBranch.mockResolvedValue(null);
  });

  it("creates a schedule and computes the next daily run", async () => {
    const row = makeScheduleRow();
    deps.store.createSchedule.mockResolvedValue(row);
    deps.store.getScheduleView.mockResolvedValue(makeScheduleView(row));

    const result = await deps.service.createSchedule({
      projectId: PROJECT_ID,
      branch: "main",
      cadence: "daily",
      hour: 9,
      timezone: "UTC",
    });

    expect(deps.branchExists).toHaveBeenCalledWith(
      expect.objectContaining({ id: PROJECT_ID }),
      "main",
    );
    expect(deps.store.createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        branch: "main",
        cadence: "daily",
        nextRunAt: new Date("2026-01-12T09:00:00.000Z"),
      }),
    );
    expect(result.nextRunAt).toBe("2026-01-10T12:00:00.000Z");
    expect(result.repositoryName).toBe("repo");
  });

  it("rejects an unknown project", async () => {
    deps.projects.getProjectById.mockResolvedValue(null);

    await expect(
      deps.service.createSchedule({ projectId: PROJECT_ID, branch: "main" }),
    ).rejects.toThrow(REPORT_ERROR_MESSAGES.projectNotFound);
  });

  it("rejects an unknown branch", async () => {
    deps.branchExists.mockResolvedValue(false);

    await expect(
      deps.service.createSchedule({ projectId: PROJECT_ID, branch: "nope" }),
    ).rejects.toThrow(REPORT_ERROR_MESSAGES.branchNotFound);
  });

  it("rejects an invalid timezone", async () => {
    await expect(
      deps.service.createSchedule({
        projectId: PROJECT_ID,
        branch: "main",
        timezone: "Mars/Olympus_Mons",
      }),
    ).rejects.toThrow(REPORT_ERROR_MESSAGES.invalidTimezone);
  });

  it("rejects a duplicate project branch schedule", async () => {
    deps.store.getScheduleByProjectBranch.mockResolvedValue(makeScheduleRow());

    await expect(
      deps.service.createSchedule({ projectId: PROJECT_ID, branch: "main" }),
    ).rejects.toThrow(REPORT_ERROR_MESSAGES.duplicateSchedule);
  });

  it("updates a schedule and recomputes the next run", async () => {
    const row = makeScheduleRow({ cadence: "weekly", dayOfWeek: 1 });
    deps.store.getSchedule.mockResolvedValue(row);
    deps.store.updateSchedule.mockResolvedValue(row);
    deps.store.getScheduleView.mockResolvedValue(makeScheduleView(row));

    await deps.service.updateSchedule(SCHEDULE_ID, {
      cadence: "weekly",
      dayOfWeek: 1,
    });

    expect(deps.store.updateSchedule).toHaveBeenCalledWith(
      SCHEDULE_ID,
      expect.objectContaining({
        cadence: "weekly",
        dayOfWeek: 1,
        nextRunAt: new Date("2026-01-12T09:00:00.000Z"),
      }),
    );
  });

  it("runs a due schedule and stores the generated report", async () => {
    const row = makeScheduleRow();
    deps.store.listDueSchedules.mockResolvedValue([row]);
    deps.store.claimSchedule.mockResolvedValue(row);
    deps.prepareBranch.mockResolvedValue({ branch: "main" });
    deps.commits.listCommitsForProject.mockResolvedValue([makeCommitRow()]);
    deps.resolveModel.mockResolvedValue({
      provider: "openrouter",
      model: { id: "model-x" },
    });
    deps.ai.generate.mockResolvedValue({ content: "Shipped reports." });

    await deps.service.runDueSchedules();

    expect(deps.store.claimSchedule).toHaveBeenCalledWith({
      id: SCHEDULE_ID,
      nextRunAt: new Date("2026-01-12T09:00:00.000Z"),
      now: NOW,
    });
    expect(deps.commits.listCommitsForProject).toHaveBeenCalledWith({
      projectId: PROJECT_ID,
      branch: "main",
      startDate: new Date("2026-01-03T12:00:00.000Z"),
      endDate: new Date("2026-01-10T11:59:59.999Z"),
    });
    expect(deps.store.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: PROJECT_ID,
        branch: "main",
        summary: "Shipped reports.",
        provider: "openrouter",
        model: "model-x",
        periodStart: new Date("2026-01-03T12:00:00.000Z"),
        periodEnd: NOW,
        sourceCommits: [
          expect.objectContaining({ commitSha: "abc123" }),
        ],
      }),
    );
    expect(deps.store.markScheduleSucceeded).toHaveBeenCalledWith({
      id: SCHEDULE_ID,
      periodEnd: NOW,
      now: NOW,
    });
  });

  it("stores only the citations that were used for the prompt", async () => {
    const row = makeScheduleRow();
    const commits = Array.from({ length: 201 }, (_, index) =>
      makeCommitRow({
        id: `commit-${index}`,
        commitSha: `sha-${index}`,
      }),
    );
    deps.store.listDueSchedules.mockResolvedValue([row]);
    deps.store.claimSchedule.mockResolvedValue(row);
    deps.prepareBranch.mockResolvedValue({ branch: "main" });
    deps.commits.listCommitsForProject.mockResolvedValue(commits);
    deps.resolveModel.mockResolvedValue({
      provider: "openrouter",
      model: { id: "model-x" },
    });
    deps.ai.generate.mockResolvedValue({ content: "Shipped reports." });

    await deps.service.runDueSchedules();

    const report = deps.store.createReport.mock.calls[0][0];
    expect(report.sourceCommits).toHaveLength(200);
    expect(report.sourceCommits[0].commitSha).toBe("sha-0");
    expect(report.sourceCommits.at(-1)?.commitSha).toBe("sha-199");
  });

  it("stores a quiet report without calling the model when there are no commits", async () => {
    const row = makeScheduleRow();
    deps.store.listDueSchedules.mockResolvedValue([row]);
    deps.store.claimSchedule.mockResolvedValue(row);
    deps.prepareBranch.mockResolvedValue({ branch: "main" });
    deps.commits.listCommitsForProject.mockResolvedValue([]);

    await deps.service.runDueSchedules();

    expect(deps.resolveModel).not.toHaveBeenCalled();
    expect(deps.store.createReport).toHaveBeenCalledWith(
      expect.objectContaining({
        summary: "No meaningful changes shipped in this period.",
        provider: null,
        model: null,
        sourceCommits: [],
      }),
    );
    expect(deps.store.markScheduleSucceeded).toHaveBeenCalled();
  });

  it("marks the schedule failed when ingestion or generation fails", async () => {
    const row = makeScheduleRow();
    deps.store.listDueSchedules.mockResolvedValue([row]);
    deps.store.claimSchedule.mockResolvedValue(row);
    deps.prepareBranch.mockRejectedValue(new Error("clone failed"));

    await deps.service.runDueSchedules();

    expect(deps.store.createReport).not.toHaveBeenCalled();
    expect(deps.store.markScheduleFailed).toHaveBeenCalledWith({
      id: SCHEDULE_ID,
      error: "clone failed",
      now: NOW,
    });
  });

  it("does nothing when another worker already claimed the schedule", async () => {
    const row = makeScheduleRow();
    deps.store.listDueSchedules.mockResolvedValue([row]);
    deps.store.claimSchedule.mockResolvedValue(null);

    await deps.service.runDueSchedules();

    expect(deps.prepareBranch).not.toHaveBeenCalled();
  });

  it("advances a due schedule when it is run manually", async () => {
    const row = makeScheduleRow();
    deps.store.getSchedule.mockResolvedValue(row);
    deps.store.markScheduleRunning.mockResolvedValue(row);
    deps.prepareBranch.mockRejectedValue(new Error("stop"));

    await deps.service.startScheduleRun(SCHEDULE_ID);

    expect(deps.store.markScheduleRunning).toHaveBeenCalledWith({
      id: SCHEDULE_ID,
      now: NOW,
      nextRunAt: new Date("2026-01-12T09:00:00.000Z"),
    });
  });

  it("does not move the next run when the schedule is not due", async () => {
    const row = makeScheduleRow({
      nextRunAt: new Date("2026-01-12T09:00:00.000Z"),
    });
    deps.store.getSchedule.mockResolvedValue(row);
    deps.store.markScheduleRunning.mockResolvedValue(row);
    deps.prepareBranch.mockRejectedValue(new Error("stop"));

    await deps.service.startScheduleRun(SCHEDULE_ID);

    expect(deps.store.markScheduleRunning).toHaveBeenCalledWith({
      id: SCHEDULE_ID,
      now: NOW,
      nextRunAt: undefined,
    });
  });

  it("keeps the Friday 9am run after a manual 8am run", async () => {
    const previousRun = new Date("2026-01-02T09:00:00.000Z");
    const manualRunAt = new Date("2026-01-09T08:00:00.000Z");
    const scheduledRunAt = new Date("2026-01-09T09:00:00.000Z");
    const schedule = makeScheduleRow({
      cadence: "weekly",
      dayOfWeek: 5,
      hour: 9,
      timezone: "UTC",
      nextRunAt: scheduledRunAt,
      lastSuccessAt: previousRun,
    });
    const state = makeStatefulService(schedule, manualRunAt);

    await state.service.startScheduleRun(SCHEDULE_ID);
    await vi.waitFor(() => expect(state.reports).toHaveLength(1));

    expect(state.getSchedule().nextRunAt).toEqual(scheduledRunAt);
    expect(state.reports[0]).toEqual(
      expect.objectContaining({
        periodStart: previousRun,
        periodEnd: manualRunAt,
      }),
    );

    state.setNow(scheduledRunAt);
    await state.service.runDueSchedules();
    await vi.waitFor(() => expect(state.reports).toHaveLength(2));

    expect(state.getSchedule().nextRunAt).toEqual(
      new Date("2026-01-16T09:00:00.000Z"),
    );
    expect(state.reports[1]).toEqual(
      expect.objectContaining({
        periodStart: manualRunAt,
        periodEnd: scheduledRunAt,
      }),
    );
  });

  it("rejects a manual run when the schedule is already running", async () => {
    deps.store.getSchedule.mockResolvedValue(makeScheduleRow());
    deps.store.markScheduleRunning.mockResolvedValue(null);

    await expect(
      deps.service.startScheduleRun(SCHEDULE_ID),
    ).rejects.toThrow(REPORT_ERROR_MESSAGES.scheduleRunning);
  });

  it("marks interrupted schedules as failed", async () => {
    deps.store.markInterruptedSchedulesFailed.mockResolvedValue(2);

    await expect(
      deps.service.resetInterruptedSchedules(),
    ).resolves.toBe(2);
    expect(deps.store.markInterruptedSchedulesFailed).toHaveBeenCalledWith({
      now: NOW,
      error: "Interrupted by restart",
    });
  });
});
