import { and, desc, eq } from "drizzle-orm";
import { db, DbOrTx, Tx } from "@/db/client";
import { reportCommits, commitChunks } from "@/db/schema";

export async function insertReportCommits({
  reportId,
  commitShas,
  tx,
}: {
  reportId: string;
  commitShas: string[];
  tx?: Tx;
}) {
  if (commitShas.length === 0) return;
  const client = tx || db;
  await client
    .insert(reportCommits)
    .values(commitShas.map((commitSha) => ({ reportId, commitSha })))
    .onConflictDoNothing();
}

export async function listCommitsForReport({
  reportId,
  projectId,
  branch,
  tx,
}: {
  reportId: string;
  projectId: string;
  branch: string;
  tx?: DbOrTx;
}) {
  const client = tx || db;
  const rows = await client
    .select({ chunk: commitChunks })
    .from(reportCommits)
    .innerJoin(
      commitChunks,
      and(
        eq(commitChunks.commitSha, reportCommits.commitSha),
        eq(commitChunks.projectId, projectId),
        eq(commitChunks.branch, branch),
      ),
    )
    .where(eq(reportCommits.reportId, reportId))
    .orderBy(desc(commitChunks.committedAt));
  return rows.map((r) => r.chunk);
}
