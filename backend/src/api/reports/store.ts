import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  lte,
  ne,
} from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import {
  projects,
  reportSchedules,
  reports,
  type GitProvider,
  type ReportRow,
  type ReportScheduleRow,
} from "@/db/schema";

export type ReportScheduleView = ReportScheduleRow & {
  repositoryName: string;
  providerOwner: string;
  gitProvider: GitProvider;
};

export type ReportView = ReportRow & {
  repositoryName: string;
  providerOwner: string;
  gitProvider: GitProvider;
};

const scheduleColumns = getTableColumns(reportSchedules);
const reportColumns = getTableColumns(reports);

const projectColumns = {
  repositoryName: projects.repositoryName,
  providerOwner: projects.providerOwner,
  gitProvider: projects.gitProvider,
};

export function createReportsStore(client: DbOrTx = db) {
  return {
    async listSchedules(): Promise<ReportScheduleView[]> {
      return client
        .select({ ...scheduleColumns, ...projectColumns })
        .from(reportSchedules)
        .innerJoin(projects, eq(projects.id, reportSchedules.projectId))
        .orderBy(desc(reportSchedules.createdAt));
    },

    async getSchedule(id: string): Promise<ReportScheduleRow | null> {
      const [row] = await client
        .select()
        .from(reportSchedules)
        .where(eq(reportSchedules.id, id))
        .limit(1);
      return row ?? null;
    },

    async getScheduleView(id: string): Promise<ReportScheduleView | null> {
      const [row] = await client
        .select({ ...scheduleColumns, ...projectColumns })
        .from(reportSchedules)
        .innerJoin(projects, eq(projects.id, reportSchedules.projectId))
        .where(eq(reportSchedules.id, id))
        .limit(1);
      return row ?? null;
    },

    async getScheduleByProjectBranch(
      projectId: string,
      branch: string,
    ): Promise<ReportScheduleRow | null> {
      const [row] = await client
        .select()
        .from(reportSchedules)
        .where(
          and(
            eq(reportSchedules.projectId, projectId),
            eq(reportSchedules.branch, branch),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    async createSchedule(
      input: typeof reportSchedules.$inferInsert,
    ): Promise<ReportScheduleRow> {
      const [row] = await client
        .insert(reportSchedules)
        .values(input)
        .returning();
      return row;
    },

    async updateSchedule(
      id: string,
      patch: Partial<typeof reportSchedules.$inferInsert>,
    ): Promise<ReportScheduleRow | null> {
      const [row] = await client
        .update(reportSchedules)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(reportSchedules.id, id))
        .returning();
      return row ?? null;
    },

    async deleteSchedule(id: string): Promise<boolean> {
      const rows = await client
        .delete(reportSchedules)
        .where(eq(reportSchedules.id, id))
        .returning({ id: reportSchedules.id });
      return rows.length > 0;
    },

    async listDueSchedules(
      now: Date,
      limit = 5,
    ): Promise<ReportScheduleRow[]> {
      return client
        .select()
        .from(reportSchedules)
        .where(
          and(
            eq(reportSchedules.enabled, true),
            lte(reportSchedules.nextRunAt, now),
            ne(reportSchedules.lastStatus, "running"),
          ),
        )
        .orderBy(asc(reportSchedules.nextRunAt))
        .limit(limit);
    },

    async claimSchedule(input: {
      id: string;
      nextRunAt: Date;
      now: Date;
    }): Promise<ReportScheduleRow | null> {
      const [row] = await client
        .update(reportSchedules)
        .set({
          nextRunAt: input.nextRunAt,
          lastRunAt: input.now,
          lastStatus: "running",
          lastError: null,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(reportSchedules.id, input.id),
            lte(reportSchedules.nextRunAt, input.now),
            ne(reportSchedules.lastStatus, "running"),
          ),
        )
        .returning();
      return row ?? null;
    },

    async markScheduleRunning(input: {
      id: string;
      now: Date;
      nextRunAt?: Date;
    }): Promise<ReportScheduleRow | null> {
      const [row] = await client
        .update(reportSchedules)
        .set({
          ...(input.nextRunAt ? { nextRunAt: input.nextRunAt } : {}),
          lastRunAt: input.now,
          lastStatus: "running",
          lastError: null,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(reportSchedules.id, input.id),
            ne(reportSchedules.lastStatus, "running"),
          ),
        )
        .returning();
      return row ?? null;
    },

    async markScheduleSucceeded(input: {
      id: string;
      periodEnd: Date;
      now: Date;
    }): Promise<void> {
      await client
        .update(reportSchedules)
        .set({
          lastStatus: "succeeded",
          lastSuccessAt: input.periodEnd,
          lastError: null,
          updatedAt: input.now,
        })
        .where(eq(reportSchedules.id, input.id));
    },

    async markScheduleFailed(input: {
      id: string;
      error: string;
      now: Date;
    }): Promise<void> {
      await client
        .update(reportSchedules)
        .set({
          lastStatus: "failed",
          lastError: input.error,
          updatedAt: input.now,
        })
        .where(eq(reportSchedules.id, input.id));
    },

    async markInterruptedSchedulesFailed(input: {
      now: Date;
      error: string;
    }): Promise<number> {
      const rows = await client
        .update(reportSchedules)
        .set({
          lastStatus: "failed",
          lastError: input.error,
          updatedAt: input.now,
        })
        .where(eq(reportSchedules.lastStatus, "running"))
        .returning({ id: reportSchedules.id });
      return rows.length;
    },

    async createReport(
      input: typeof reports.$inferInsert,
    ): Promise<ReportRow> {
      const [row] = await client.insert(reports).values(input).returning();
      return row;
    },

    async listReports(input: {
      projectId?: string;
      branch?: string;
      limit: number;
    }): Promise<ReportView[]> {
      const conditions = [];
      if (input.projectId) {
        conditions.push(eq(reports.projectId, input.projectId));
      }
      if (input.branch) {
        conditions.push(eq(reports.branch, input.branch));
      }
      return client
        .select({ ...reportColumns, ...projectColumns })
        .from(reports)
        .innerJoin(projects, eq(projects.id, reports.projectId))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(reports.createdAt))
        .limit(input.limit);
    },

    async getReport(id: string): Promise<ReportView | null> {
      const [row] = await client
        .select({ ...reportColumns, ...projectColumns })
        .from(reports)
        .innerJoin(projects, eq(projects.id, reports.projectId))
        .where(eq(reports.id, id))
        .limit(1);
      return row ?? null;
    },
  };
}

export const reportsStore = createReportsStore();
