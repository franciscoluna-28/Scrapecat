import { and, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { db, DbOrTx, Tx } from "@/db/client";
import { reportCommits, commitChunks, type CommitChunkMetadata } from "@/db/schema";

export type ReportCommitRow = {
  id: string;
  projectId: string;
  commitSha: string;
  branch: string;
  commitMessage: string;
  author: string | null;
  diffSummary: string;
  committedAt: Date;
  metadata: CommitChunkMetadata | null;
};

export type ReportCommitsCursor = { at: string; id: string };

export function encodeReportCommitsCursor(cursor: ReportCommitsCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeReportCommitsCursor(raw: string): ReportCommitsCursor {
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as {
      at?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.at !== "string" ||
      typeof parsed.id !== "string" ||
      Number.isNaN(new Date(parsed.at).getTime())
    ) {
      throw new Error("invalid cursor");
    }
    return { at: parsed.at, id: parsed.id };
  } catch {
    throw new Error("invalid cursor");
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

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

function commitConditions({
  reportId,
  projectId,
  branch,
  q,
  cursor,
}: {
  reportId: string;
  projectId: string;
  branch: string;
  q?: string;
  cursor?: ReportCommitsCursor;
}) {
  const conditions = [
    eq(reportCommits.reportId, reportId),
    eq(commitChunks.projectId, projectId),
    eq(commitChunks.branch, branch),
  ];
  if (q) {
    conditions.push(ilike(commitChunks.commitMessage, `%${escapeLike(q)}%`));
  }
  if (cursor) {
    conditions.push(
      sql`(${commitChunks.committedAt}, ${commitChunks.id}) < (${cursor.at}, ${cursor.id})`,
    );
  }
  return conditions;
}

export async function listCommitsForReport({
  reportId,
  projectId,
  branch,
  q,
  cursor,
  limit = 50,
  tx,
}: {
  reportId: string;
  projectId: string;
  branch: string;
  q?: string;
  cursor?: ReportCommitsCursor;
  limit?: number;
  tx?: DbOrTx;
}): Promise<{ rows: ReportCommitRow[]; nextCursor: ReportCommitsCursor | null }> {
  const client = tx || db;
  const conditions = commitConditions({ reportId, projectId, branch, q, cursor });

  const rows = await client
    .select({
      id: commitChunks.id,
      projectId: commitChunks.projectId,
      commitSha: commitChunks.commitSha,
      branch: commitChunks.branch,
      commitMessage: commitChunks.commitMessage,
      author: commitChunks.author,
      diffSummary: commitChunks.diffSummary,
      committedAt: commitChunks.committedAt,
      metadata: commitChunks.metadata,
    })
    .from(reportCommits)
    .innerJoin(
      commitChunks,
      and(
        eq(commitChunks.commitSha, reportCommits.commitSha),
        eq(commitChunks.projectId, projectId),
        eq(commitChunks.branch, branch),
      ),
    )
    .where(and(...conditions))
    .orderBy(desc(commitChunks.committedAt), desc(commitChunks.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    nextCursor: hasMore && last ? { at: last.committedAt.toISOString(), id: last.id } : null,
  };
}

export async function countCommitsForReport({
  reportId,
  projectId,
  branch,
  q,
  tx,
}: {
  reportId: string;
  projectId: string;
  branch: string;
  q?: string;
  tx?: DbOrTx;
}): Promise<number> {
  const client = tx || db;
  const conditions = commitConditions({ reportId, projectId, branch, q });
  const [row] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(reportCommits)
    .innerJoin(
      commitChunks,
      and(
        eq(commitChunks.commitSha, reportCommits.commitSha),
        eq(commitChunks.projectId, projectId),
        eq(commitChunks.branch, branch),
      ),
    )
    .where(and(...conditions));
  return row?.count ?? 0;
}

function windowConditions({
  projectId,
  branch,
  startDate,
  endDate,
  q,
  cursor,
}: {
  projectId: string;
  branch: string;
  startDate?: Date;
  endDate?: Date;
  q?: string;
  cursor?: ReportCommitsCursor;
}) {
  const conditions = [
    eq(commitChunks.projectId, projectId),
    eq(commitChunks.branch, branch),
  ];
  if (startDate) conditions.push(gte(commitChunks.committedAt, startDate));
  if (endDate) conditions.push(lte(commitChunks.committedAt, endDate));
  if (q) {
    conditions.push(ilike(commitChunks.commitMessage, `%${escapeLike(q)}%`));
  }
  if (cursor) {
    conditions.push(
      sql`(${commitChunks.committedAt}, ${commitChunks.id}) < (${cursor.at}, ${cursor.id})`,
    );
  }
  return conditions;
}

const WINDOW_COMMIT_COLUMNS = {
  id: commitChunks.id,
  projectId: commitChunks.projectId,
  commitSha: commitChunks.commitSha,
  branch: commitChunks.branch,
  commitMessage: commitChunks.commitMessage,
  author: commitChunks.author,
  diffSummary: commitChunks.diffSummary,
  committedAt: commitChunks.committedAt,
  metadata: commitChunks.metadata,
};

/**
 * Cursor-paginated commits for an ingested window (before a report exists),
 * served straight from `commit_chunks` — the DB is the read model, no git work.
 */
export async function listCommitsForWindow({
  projectId,
  branch,
  startDate,
  endDate,
  q,
  cursor,
  limit = 50,
  tx,
}: {
  projectId: string;
  branch: string;
  startDate?: Date;
  endDate?: Date;
  q?: string;
  cursor?: ReportCommitsCursor;
  limit?: number;
  tx?: DbOrTx;
}): Promise<{ rows: ReportCommitRow[]; nextCursor: ReportCommitsCursor | null }> {
  const client = tx || db;
  const conditions = windowConditions({ projectId, branch, startDate, endDate, q, cursor });

  const rows = await client
    .select(WINDOW_COMMIT_COLUMNS)
    .from(commitChunks)
    .where(and(...conditions))
    .orderBy(desc(commitChunks.committedAt), desc(commitChunks.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page as ReportCommitRow[],
    nextCursor: hasMore && last ? { at: last.committedAt.toISOString(), id: last.id } : null,
  };
}

export async function countCommitsForWindow({
  projectId,
  branch,
  startDate,
  endDate,
  q,
  tx,
}: {
  projectId: string;
  branch: string;
  startDate?: Date;
  endDate?: Date;
  q?: string;
  tx?: DbOrTx;
}): Promise<number> {
  const client = tx || db;
  const conditions = windowConditions({ projectId, branch, startDate, endDate, q });
  const [row] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(commitChunks)
    .where(and(...conditions));
  return row?.count ?? 0;
}
