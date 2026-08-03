import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { reports } from "@/db/schema";

export type ReportInput = {
  id?: string;
  projectId: string;
  title: string;
  originalMarkdown: string;
  editableMarkdown: string;
  startDate: Date;
  endDate: Date;
  branch: string;
  customInstructions?: string | null;
};

export async function createReport(input: ReportInput) {
  const [row] = await db
    .insert(reports)
    .values({
      id: input.id,
      projectId: input.projectId,
      title: input.title,
      originalMarkdown: input.originalMarkdown,
      editableMarkdown: input.editableMarkdown,
      startDate: input.startDate,
      endDate: input.endDate,
      branch: input.branch,
      customInstructions: input.customInstructions ?? null,
    })
    .returning();
  return row;
}

export async function listReports(opts?: { projectId?: string }) {
  const query = db.select().from(reports);
  if (opts?.projectId) {
    query.where(eq(reports.projectId, opts.projectId));
  }
  return query.orderBy(desc(reports.updatedAt));
}

export async function getReport(id: string) {
  const [row] = await db
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateReportMarkdown(id: string, editableMarkdown: string) {
  const [row] = await db
    .update(reports)
    .set({ editableMarkdown, updatedAt: new Date() })
    .where(eq(reports.id, id))
    .returning();
  return row ?? null;
}
