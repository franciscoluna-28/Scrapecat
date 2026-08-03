import { createHash } from "crypto";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { commitChunks, type CommitChunkMetadata } from "@/db/schema";

export type CommitChunkInput = {
  projectId: string;
  commitSha: string;
  commitMessage: string;
  author?: string | null;
  diffSummary: string;
  metadata?: CommitChunkMetadata;
  committedAt: Date;
};

export function contentHashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

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
        contentHash: contentHashOf(i.diffSummary),
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
        contentHash: sql`excluded.content_hash`,
        metadata: sql`excluded.metadata`,
        committedAt: sql`excluded.committed_at`,
        updatedAt: sql`now()`,
      },
    });
}

export async function getChunksByShas(
  projectId: string,
  shas: string[],
): Promise<Map<string, { commitSha: string; diffSummary: string; metadata: CommitChunkMetadata; contentHash: string | null }>> {
  if (shas.length === 0) return new Map();
  const rows = await db
    .select({
      commitSha: commitChunks.commitSha,
      diffSummary: commitChunks.diffSummary,
      metadata: commitChunks.metadata,
      contentHash: commitChunks.contentHash,
    })
    .from(commitChunks)
    .where(and(eq(commitChunks.projectId, projectId), inArray(commitChunks.commitSha, shas)));
  return new Map(rows.map((r) => [r.commitSha, { ...r, metadata: r.metadata ?? {} }]));
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
