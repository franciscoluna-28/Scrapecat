import { logger } from "@/shared/logger";
import { getGitProvider } from "@/shared/integrations/git-provider";
import { resolveGitToken } from "@/shared/integrations/git-provider/token";
import { type AIResponse, aiClient, resolveChatModel } from "@/chat/ai";
import { projectsStore } from "@/projects/stores/projects-store";
import { commitChunksStore } from "@/projects/stores/commit-chunks-store";
import { prepareProjectBranch } from "@/projects/services";
import {
  createReportsStore,
  type ReportScheduleView,
  type ReportView,
} from "@/reports/store";
import {
  computeInitialPeriodStart,
  computeNextRun,
  isValidTimeZone,
} from "@/reports/next-run";
import {
  buildReportMessages,
  REPORT_PROMPT_COMMIT_LIMIT,
} from "@/reports/prompt";
import {
  DEFAULT_CADENCE,
  DEFAULT_DAY_OF_WEEK,
  DEFAULT_HOUR,
  DEFAULT_TIMEZONE,
  type ReportCadence,
  type ReportStatus,
} from "@/reports/types";
import {
  projects,
  type ChatCitation,
  type ReportScheduleRow,
} from "@/db/schema";

type ProjectRow = typeof projects.$inferSelect;
type CommitChunkRow = Awaited<
  ReturnType<typeof commitChunksStore.listCommitsForProject>
>[number];

export const REPORT_ERROR_MESSAGES = {
  projectNotFound: "Project not found",
  branchNotFound: "Branch not found",
  branchUnavailable: "Could not verify branch",
  duplicateSchedule: "A schedule already exists for this project and branch",
  scheduleNotFound: "Schedule not found",
  scheduleRunning: "Schedule is already running",
  reportNotFound: "Report not found",
  invalidTimezone: "Invalid timezone",
} as const;

export type ReportScheduleDTO = {
  id: string;
  projectId: string;
  branch: string;
  cadence: ReportCadence;
  dayOfWeek: number;
  hour: number;
  timezone: string;
  enabled: boolean;
  nextRunAt: string;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: ReportStatus;
  lastError: string | null;
  repositoryName: string;
  providerOwner: string;
  gitProvider: ProjectRow["gitProvider"];
  createdAt: string;
  updatedAt: string;
};

export type ReportSummaryDTO = {
  id: string;
  projectId: string;
  branch: string;
  repositoryName: string;
  providerOwner: string;
  gitProvider: ProjectRow["gitProvider"];
  summary: string;
  provider: string | null;
  model: string | null;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
};

export type ReportDTO = ReportSummaryDTO & {
  sourceCommits: ChatCitation[];
};

type ReportsServiceDeps = {
  store: ReturnType<typeof createReportsStore>;
  projects: Pick<typeof projectsStore, "getProjectById">;
  commits: Pick<typeof commitChunksStore, "listCommitsForProject">;
  prepareBranch: typeof prepareProjectBranch;
  ai: Pick<typeof aiClient, "generate">;
  resolveModel: typeof resolveChatModel;
  branchExists: (project: ProjectRow, branch: string) => Promise<boolean>;
  now: () => Date;
};

async function defaultBranchExists(
  project: ProjectRow,
  branch: string,
): Promise<boolean> {
  const provider = getGitProvider(
    project.gitProvider,
    await resolveGitToken(project.gitProvider),
  );
  const branches = await provider.listBranches(
    project.providerOwner,
    project.repositoryName,
  );
  return branches.includes(branch);
}

const defaultDeps: ReportsServiceDeps = {
  store: createReportsStore(),
  projects: projectsStore,
  commits: commitChunksStore,
  prepareBranch: prepareProjectBranch,
  ai: aiClient,
  resolveModel: resolveChatModel,
  branchExists: defaultBranchExists,
  now: () => new Date(),
};

function toScheduleDTO(row: ReportScheduleView): ReportScheduleDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    branch: row.branch,
    cadence: row.cadence as ReportCadence,
    dayOfWeek: row.dayOfWeek,
    hour: row.hour,
    timezone: row.timezone,
    enabled: row.enabled,
    nextRunAt: row.nextRunAt.toISOString(),
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastSuccessAt: row.lastSuccessAt?.toISOString() ?? null,
    lastStatus: row.lastStatus as ReportStatus,
    lastError: row.lastError,
    repositoryName: row.repositoryName,
    providerOwner: row.providerOwner,
    gitProvider: row.gitProvider,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toReportSummary(row: ReportView): ReportSummaryDTO {
  return {
    id: row.id,
    projectId: row.projectId,
    branch: row.branch,
    repositoryName: row.repositoryName,
    providerOwner: row.providerOwner,
    gitProvider: row.gitProvider,
    summary: row.summary,
    provider: row.provider,
    model: row.model,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function toReportDTO(row: ReportView): ReportDTO {
  return {
    ...toReportSummary(row),
    sourceCommits: row.sourceCommits ?? [],
  };
}

function toCitation(row: CommitChunkRow): ChatCitation {
  return {
    commitSha: row.commitSha,
    commitMessage: row.commitMessage,
    author: row.author,
    committedAt: row.committedAt.toISOString(),
    filesChanged: row.metadata?.filesChanged ?? [],
    commitUrl: row.metadata?.commitUrl ?? null,
  };
}

export function createReportsService(
  overrides: Partial<ReportsServiceDeps> = {},
) {
  const deps = { ...defaultDeps, ...overrides };

  async function requireProject(projectId: string): Promise<ProjectRow> {
    const project = await deps.projects.getProjectById(projectId);
    if (!project) throw new Error(REPORT_ERROR_MESSAGES.projectNotFound);
    return project;
  }

  async function requireBranch(
    project: ProjectRow,
    branch: string,
  ): Promise<void> {
    let exists: boolean;
    try {
      exists = await deps.branchExists(project, branch);
    } catch {
      throw new Error(REPORT_ERROR_MESSAGES.branchUnavailable);
    }
    if (!exists) throw new Error(REPORT_ERROR_MESSAGES.branchNotFound);
  }

  function requireTimeZone(timeZone: string): void {
    if (!isValidTimeZone(timeZone)) {
      throw new Error(REPORT_ERROR_MESSAGES.invalidTimezone);
    }
  }

  async function listSchedules(): Promise<ReportScheduleDTO[]> {
    const rows = await deps.store.listSchedules();
    return rows.map(toScheduleDTO);
  }

  async function createSchedule(input: {
    projectId: string;
    branch: string;
    cadence?: ReportCadence;
    dayOfWeek?: number;
    hour?: number;
    timezone?: string;
    enabled?: boolean;
  }): Promise<ReportScheduleDTO> {
    const project = await requireProject(input.projectId);
    await requireBranch(project, input.branch);

    const existing = await deps.store.getScheduleByProjectBranch(
      input.projectId,
      input.branch,
    );
    if (existing) throw new Error(REPORT_ERROR_MESSAGES.duplicateSchedule);

    const now = deps.now();
    const cadence = input.cadence ?? DEFAULT_CADENCE;
    const dayOfWeek = input.dayOfWeek ?? DEFAULT_DAY_OF_WEEK;
    const hour = input.hour ?? DEFAULT_HOUR;
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;
    requireTimeZone(timezone);

    let row: ReportScheduleRow;
    try {
      row = await deps.store.createSchedule({
        projectId: input.projectId,
        branch: input.branch,
        cadence,
        dayOfWeek,
        hour,
        timezone,
        enabled: input.enabled ?? true,
        nextRunAt: computeNextRun(
          { cadence, dayOfWeek, hour, timezone },
          now,
        ),
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new Error(REPORT_ERROR_MESSAGES.duplicateSchedule);
      }
      throw error;
    }

    const view = await deps.store.getScheduleView(row.id);
    if (!view) throw new Error(REPORT_ERROR_MESSAGES.scheduleNotFound);
    return toScheduleDTO(view);
  }

  async function updateSchedule(
    id: string,
    input: {
      cadence?: ReportCadence;
      dayOfWeek?: number;
      hour?: number;
      timezone?: string;
      enabled?: boolean;
    },
  ): Promise<ReportScheduleDTO> {
    const current = await deps.store.getSchedule(id);
    if (!current) throw new Error(REPORT_ERROR_MESSAGES.scheduleNotFound);

    const now = deps.now();
    const cadence = input.cadence ?? (current.cadence as ReportCadence);
    const dayOfWeek = input.dayOfWeek ?? current.dayOfWeek;
    const hour = input.hour ?? current.hour;
    const timezone = input.timezone ?? current.timezone;
    const enabled = input.enabled ?? current.enabled;
    requireTimeZone(timezone);

    const updated = await deps.store.updateSchedule(id, {
      cadence,
      dayOfWeek,
      hour,
      timezone,
      enabled,
      nextRunAt: computeNextRun(
        { cadence, dayOfWeek, hour, timezone },
        now,
      ),
    });
    if (!updated) throw new Error(REPORT_ERROR_MESSAGES.scheduleNotFound);

    const view = await deps.store.getScheduleView(id);
    if (!view) throw new Error(REPORT_ERROR_MESSAGES.scheduleNotFound);
    return toScheduleDTO(view);
  }

  async function deleteSchedule(id: string): Promise<void> {
    const deleted = await deps.store.deleteSchedule(id);
    if (!deleted) throw new Error(REPORT_ERROR_MESSAGES.scheduleNotFound);
  }

  async function listReports(input: {
    projectId?: string;
    branch?: string;
    limit: number;
  }): Promise<ReportSummaryDTO[]> {
    const rows = await deps.store.listReports(input);
    return rows.map(toReportSummary);
  }

  async function getReport(id: string): Promise<ReportDTO> {
    const row = await deps.store.getReport(id);
    if (!row) throw new Error(REPORT_ERROR_MESSAGES.reportNotFound);
    return toReportDTO(row);
  }

  async function executeSchedule(
    schedule: ReportScheduleRow,
    now: Date,
  ): Promise<void> {
    const periodStart =
      schedule.lastSuccessAt ?? computeInitialPeriodStart(now);
    const periodEnd = now;

    try {
      const project = await requireProject(schedule.projectId);
      const prepared = await deps.prepareBranch(
        schedule.projectId,
        schedule.branch,
      );
      const branch = prepared.branch || schedule.branch;
      const commits = await deps.commits.listCommitsForProject({
        projectId: schedule.projectId,
        branch,
        startDate: periodStart,
        endDate: new Date(periodEnd.getTime() - 1),
      });

      const citations = commits.map(toCitation);
      const usedCitations = citations.slice(0, REPORT_PROMPT_COMMIT_LIMIT);
      let summary: string;
      let provider: string | null = null;
      let model: string | null = null;

      if (commits.length === 0) {
        summary = "No meaningful changes shipped in this period.";
      } else {
        const resolved = await deps.resolveModel();
        provider = resolved.provider;
        model = resolved.model.id;
        const result: AIResponse = await deps.ai.generate({
          model: resolved,
          messages: buildReportMessages({
            repository: `${project.providerOwner}/${project.repositoryName}`,
            branch,
            periodStart,
            periodEnd,
            now,
            citations: usedCitations,
          }),
        });
        summary = result.content;
      }

      await deps.store.createReport({
        projectId: schedule.projectId,
        branch,
        summary,
        sourceCommits: usedCitations,
        provider,
        model,
        periodStart,
        periodEnd,
      });
      await deps.store.markScheduleSucceeded({
        id: schedule.id,
        periodEnd,
        now,
      });
      logger.info(
        {
          scheduleId: schedule.id,
          projectId: schedule.projectId,
          branch,
          commitsFound: citations.length,
          commitsUsed: usedCitations.length,
          provider,
          model,
        },
        "report schedule succeeded",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await deps.store.markScheduleFailed({
        id: schedule.id,
        error: message,
        now: deps.now(),
      });
      logger.error(
        { scheduleId: schedule.id, err: message },
        "report schedule failed",
      );
    }
  }

  async function runDueSchedules(): Promise<void> {
    const now = deps.now();
    const due = await deps.store.listDueSchedules(now);
    for (const schedule of due) {
      const nextRunAt = computeNextRun(schedule, now);
      const claimed = await deps.store.claimSchedule({
        id: schedule.id,
        nextRunAt,
        now,
      });
      if (!claimed) continue;
      await executeSchedule(claimed, now);
    }
  }

  async function startScheduleRun(
    id: string,
  ): Promise<{ scheduleId: string; status: ReportStatus }> {
    const current = await deps.store.getSchedule(id);
    if (!current) throw new Error(REPORT_ERROR_MESSAGES.scheduleNotFound);

    const now = deps.now();
    const claimed = await deps.store.markScheduleRunning({
      id,
      now,
      nextRunAt:
        current.nextRunAt.getTime() <= now.getTime()
          ? computeNextRun(current, now)
          : undefined,
    });
    if (!claimed) throw new Error(REPORT_ERROR_MESSAGES.scheduleRunning);

    void executeSchedule(claimed, now).catch((error) => {
      logger.error(
        {
          scheduleId: id,
          err: error instanceof Error ? error.message : String(error),
        },
        "manual report schedule run failed",
      );
    });

    return { scheduleId: id, status: "running" };
  }

  async function resetInterruptedSchedules(): Promise<number> {
    const count = await deps.store.markInterruptedSchedulesFailed({
      now: deps.now(),
      error: "Interrupted by restart",
    });
    if (count > 0) {
      logger.info({ count }, "marked interrupted report schedules as failed");
    }
    return count;
  }

  return {
    listSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    listReports,
    getReport,
    runDueSchedules,
    startScheduleRun,
    resetInterruptedSchedules,
  };
}

export const reportsService = createReportsService();
