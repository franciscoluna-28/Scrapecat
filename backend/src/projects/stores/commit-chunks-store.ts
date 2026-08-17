import { createHash } from "crypto";
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db, DbOrTx, Tx } from "@/db/client";
import { commitChunks, type CommitChunkMetadata } from "@/db/schema";

export type CommitChunkInput = {
  projectId: string;
  commitSha: string;
  branch?: string;
  commitMessage: string;
  author?: string | null;
  diffSummary: string;
  diffPatch?: string;
  metadata?: CommitChunkMetadata;
  committedAt: Date;
};

export function contentHashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export async function upsertCommitChunks({
  inputs,
  tx,
}: {
  inputs: CommitChunkInput[];
  tx?: Tx;
}) {
  if (inputs.length === 0) return;
  const client = tx || db;
  await client
    .insert(commitChunks)
    .values(
      inputs.map((i) => ({
        projectId: i.projectId,
        commitSha: i.commitSha,
        branch: i.branch ?? "main",
        commitMessage: i.commitMessage,
        author: i.author ?? null,
        diffSummary: i.diffSummary,
        diffPatch: i.diffPatch ?? null,
        contentHash: contentHashOf(i.diffSummary),
        metadata: i.metadata ?? {},
        committedAt: i.committedAt,
      })),
    )
    .onConflictDoUpdate({
      target: [commitChunks.projectId, commitChunks.commitSha, commitChunks.branch],
      set: {
        commitMessage: sql`excluded.commit_message`,
        author: sql`excluded.author`,
        diffSummary: sql`excluded.diff_summary`,
        diffPatch: sql`excluded.diff_patch`,
        contentHash: sql`excluded.content_hash`,
        metadata: sql`excluded.metadata`,
        committedAt: sql`excluded.committed_at`,
        updatedAt: sql`now()`,
      },
    });
}

export async function countChunksForProject({
  projectId,
  branch,
  embeddedOnly,
  tx,
}: {
  projectId: string;
  branch?: string;
  embeddedOnly?: boolean;
  tx?: DbOrTx;
}): Promise<number> {
  const client = tx || db;
  const conditions = [eq(commitChunks.projectId, projectId)];
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  if (embeddedOnly) conditions.push(isNotNull(commitChunks.embedding));
  const [row] = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(commitChunks)
    .where(and(...conditions));
  return row?.count ?? 0;
}

export async function getChunksByShas({
  projectId,
  shas,
  branch,
  tx,
}: {
  projectId: string;
  shas: string[];
  branch?: string;
  tx?: DbOrTx;
}): Promise<Map<string, { commitSha: string; diffSummary: string; metadata: CommitChunkMetadata; contentHash: string | null }>> {
  if (shas.length === 0) return new Map();
  const client = tx || db;
  const conditions = [
    eq(commitChunks.projectId, projectId),
    inArray(commitChunks.commitSha, shas),
  ];
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  const rows = await client
    .select({
      commitSha: commitChunks.commitSha,
      diffSummary: commitChunks.diffSummary,
      metadata: commitChunks.metadata,
      contentHash: commitChunks.contentHash,
    })
    .from(commitChunks)
    .where(and(...conditions));
  return new Map(rows.map((r) => [r.commitSha, { ...r, metadata: r.metadata ?? {} }]));
}

export async function listCommitsForProject({
  projectId,
  tx,
  startDate,
  endDate,
  branch,
}: {
  projectId: string;
  tx?: DbOrTx;
  startDate?: Date;
  endDate?: Date;
  branch?: string;
}) {
  const client = tx || db;
  const conditions = [eq(commitChunks.projectId, projectId)];
  if (startDate) conditions.push(gte(commitChunks.committedAt, startDate));
  if (endDate) conditions.push(lte(commitChunks.committedAt, endDate));
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  return client
    .select()
    .from(commitChunks)
    .where(and(...conditions))
    .orderBy(desc(commitChunks.committedAt));
}
