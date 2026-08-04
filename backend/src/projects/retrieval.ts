import { and, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { commitChunks } from "@/db/schema";

export type RetrievedChunk = {
  id: string;
  commitSha: string;
  commitMessage: string;
  author: string | null;
  diffSummary: string;
  committedAt: Date;
  similarity: number;
};

export async function searchChunks({
  projectId,
  queryVector,
  limit = 5,
  branch,
  startDate,
  endDate,
  minSimilarity,
}: {
  projectId: string;
  queryVector: number[];
  limit?: number;
  branch?: string;
  startDate?: Date;
  endDate?: Date;
  minSimilarity?: number;
}): Promise<RetrievedChunk[]> {
  const conditions = [
    eq(commitChunks.projectId, projectId),
    isNotNull(commitChunks.embedding),
  ];
  if (branch) conditions.push(eq(commitChunks.branch, branch));
  if (startDate) conditions.push(gte(commitChunks.committedAt, startDate));
  if (endDate) conditions.push(lte(commitChunks.committedAt, endDate));

  // pgvector `<->` is cosine *distance*; 1 - distance = cosine similarity.
  // The vector must be passed as the pgvector literal format, not a native PG array.
  const vec = `[${queryVector.join(",")}]`;
  if (minSimilarity != null) {
    conditions.push(sql`1 - (${commitChunks.embedding} <=> ${vec}::vector) >= ${minSimilarity}`);
  }

  return db
    .select({
      id: commitChunks.id,
      commitSha: commitChunks.commitSha,
      commitMessage: commitChunks.commitMessage,
      author: commitChunks.author,
      diffSummary: commitChunks.diffSummary,
      committedAt: commitChunks.committedAt,
      similarity: sql<number>`1 - (${commitChunks.embedding} <=> ${vec}::vector)`,
    })
    .from(commitChunks)
    .where(and(...conditions))
    .orderBy(sql`${commitChunks.embedding} <=> ${vec}::vector`)
    .limit(limit);
}
