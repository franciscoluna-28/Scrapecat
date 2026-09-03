import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db, DbOrTx, Tx } from "@/db/client";
import { reports } from "@/db/schema";

export type ReportInput = {
  id?: string;
  projectId: string;
  sessionId?: string | null;
  title: string;
  originalMarkdown: string;
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
      sessionId: input.sessionId ?? null,
      title: input.title,
      originalMarkdown: input.originalMarkdown,
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
  startDate,
  endDate,
  tx,
}: {
  projectId?: string;
  startDate?: string;
  endDate?: string;
  tx?: DbOrTx;
}) {
  const client = tx || db;
  const conditions = [];
  if (projectId) {
    conditions.push(eq(reports.projectId, projectId));
  }
  if (startDate) {
    conditions.push(gte(reports.createdAt, new Date(startDate)));
  }
  if (endDate) {
    const end = new Date(endDate);
    end.setDate(end.getDate() + 1);
    conditions.push(lte(reports.createdAt, end));
  }
  const query = client.select().from(reports);
  if (conditions.length > 0) {
    query.where(and(...conditions));
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
