import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "../client";
import { commitChunks } from "../schema";

export type CommitChunkInput = {
  projectId: string;
  commitSha: string;
  commitMessage: string;
  author?: string | null;
  diffSummary: string;
  metadata?: {
    filesChanged?: string[];
    additions?: number;
    deletions?: number;
  };
  committedAt: Date;
};

export async function upsertCommitChunks(inputs: CommitChunkInput[]) {
  if (inputs.length === 0) return;
  await db
    .insert(commitChunks)
    .values(
      inputs.map((i) => ({
        projectId: i.projectId,
        commitSha: i.commitSha,
        commitMessage: i.commitMessage,
        author: i.author ?? null,
        diffSummary: i.diffSummary,
        metadata: i.metadata ?? {},
        committedAt: i.committedAt,
      })),
    )
    .onConflictDoUpdate({
      target: [commitChunks.projectId, commitChunks.commitSha],
      set: {
        commitMessage: sql`excluded.commit_message`,
        author: sql`excluded.author`,
        diffSummary: sql`excluded.diff_summary`,
        metadata: sql`excluded.metadata`,
        committedAt: sql`excluded.committed_at`,
      },
    });
}

export async function listCommitsForProject(
  projectId: string,
  opts?: { startDate?: Date; endDate?: Date },
) {
  const conditions = [eq(commitChunks.projectId, projectId)];
  if (opts?.startDate) conditions.push(gte(commitChunks.committedAt, opts.startDate));
  if (opts?.endDate) conditions.push(lte(commitChunks.committedAt, opts.endDate));
  return db
    .select()
    .from(commitChunks)
    .where(and(...conditions))
    .orderBy(desc(commitChunks.committedAt));
}
