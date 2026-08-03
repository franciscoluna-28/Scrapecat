import { desc, eq } from "drizzle-orm";
import { db, DbOrTx, Tx } from "@/db/client";
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

export async function createReport({
  input,
  tx,
}: {
  input: ReportInput;
  tx?: Tx;
}) {
  const client = tx || db;
  const [row] = await client
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

export async function listReports({
  projectId,
  tx,
}: {
  projectId?: string;
  tx?: DbOrTx;
}) {
  const client = tx || db;
  const query = client.select().from(reports);
  if (projectId) {
    query.where(eq(reports.projectId, projectId));
  }
  return query.orderBy(desc(reports.updatedAt));
}

export async function getReport({
  id,
  tx,
}: {
  id: string;
  tx?: DbOrTx;
}) {
  const client = tx || db;
  const [row] = await client
    .select()
    .from(reports)
    .where(eq(reports.id, id))
    .limit(1);
  return row ?? null;
}

export async function updateReportMarkdown({
  id,
  editableMarkdown,
  tx,
}: {
  id: string;
  editableMarkdown: string;
  tx?: Tx;
}) {
  const client = tx || db;
  const [row] = await client
    .update(reports)
    .set({ editableMarkdown, updatedAt: new Date() })
    .where(eq(reports.id, id))
    .returning();
  return row ?? null;
}
