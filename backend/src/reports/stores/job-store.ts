import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { reportJobs } from "@/db/schema";
import type { CreateReportInput } from "@/reports/schemas";

export type ReportJobStatus = "queued" | "running" | "succeeded" | "failed";
export type ReportJobPhase = "ingestion" | "generation" | null;

export type ReportJobRow = {
  id: string;
  status: ReportJobStatus;
  phase: ReportJobPhase;
  commitCount: number;
  progress: string | null;
  error: { message: string; status: number } | null;
  data: CreateReportInput;
  projectId: string | null;
  reportId: string | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
};

export type ReportJobPatch = {
  status?: ReportJobStatus;
  phase?: ReportJobPhase;
  commitCount?: number;
  progress?: string | null;
  error?: { message: string; status: number } | null;
  projectId?: string | null;
  reportId?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
};

export async function createJob({
  id,
  data,
}: {
  id: string;
  data: CreateReportInput;
}): Promise<ReportJobRow> {
  const [row] = await db.insert(reportJobs).values({ id, data }).returning();
  return row as ReportJobRow;
}

export async function getJob(id: string): Promise<ReportJobRow | null> {
  const [row] = await db
    .select()
    .from(reportJobs)
    .where(eq(reportJobs.id, id))
    .limit(1);
  return (row as ReportJobRow) ?? null;
}

export async function updateJob(id: string, patch: ReportJobPatch): Promise<ReportJobRow | null> {
  const [row] = await db
    .update(reportJobs)
    .set(patch)
    .where(eq(reportJobs.id, id))
    .returning();
  return (row as ReportJobRow) ?? null;
}

/**
 * Applies a progress/commitCount update only while the job is still running,
 * so a late progress write can never clobber the terminal state.
 */
export async function updateJobProgress(
  id: string,
  patch: { commitCount?: number; progress?: string },
): Promise<ReportJobRow | null> {
  const [row] = await db
    .update(reportJobs)
    .set(patch)
    .where(and(eq(reportJobs.id, id), inArray(reportJobs.status, ["queued", "running"])))
    .returning();
  return (row as ReportJobRow) ?? null;
}

/**
 * On boot, any job that wasn't finished was interrupted by the previous
 * process. Fail them so they never hang the SSE stream or the frontend.
 */
export async function failOrphanedJobs(): Promise<number> {
  const rows = await db
    .update(reportJobs)
    .set({
      status: "failed",
      error: { message: "Report job interrupted by server restart. Please try again.", status: 500 },
      finishedAt: new Date(),
    })
    .where(inArray(reportJobs.status, ["queued", "running"]))
    .returning({ id: reportJobs.id });
  return rows.length;
}
