import {
  and,
  asc,
  cosineDistance,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import { commitChunks, type CommitChunkMetadata } from "@/db/schema";
import type { EmbeddingSpace } from "@/projects/embeddings";
import { contentHashOf, embeddingSource } from "@/shared/utils";

export type CommitChunkInput = {
  projectId: string;
  commitSha: string;
  branch?: string;
  commitMessage: string;
  author?: string | null;
  metadata?: CommitChunkMetadata;
  committedAt: Date;
};

export type ChunkEmbeddingUpdate = {
  id: string;
  embedding: number[];
  contentHash: string;
};

export type CommitSearchResult = {
  id: string;
  commitSha: string;
  commitMessage: string;
  author: string | null;
  committedAt: Date;
  metadata: CommitChunkMetadata;
  distance: number | null;
};

function vectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export function createCommitChunksStore(client: DbOrTx = db) {
  return {
    async upsertCommitChunks(inputs: CommitChunkInput[]) {
      if (inputs.length === 0) return;
      await client
        .insert(commitChunks)
        .values(
          inputs.map((i) => ({
            projectId: i.projectId,
            commitSha: i.commitSha,
            branch: i.branch ?? "main",
            commitMessage: i.commitMessage,
            author: i.author ?? null,
            contentHash: contentHashOf(embeddingSource(i.committedAt, i.commitMessage)),
            metadata: i.metadata ?? {},
            committedAt: i.committedAt,
          })),
        )
        .onConflictDoUpdate({
          target: [commitChunks.projectId, commitChunks.commitSha, commitChunks.branch],
          set: {
            commitMessage: sql`excluded.commit_message`,
            author: sql`excluded.author`,
            contentHash: sql`excluded.content_hash`,
            metadata: sql`excluded.metadata`,
            committedAt: sql`excluded.committed_at`,
            updatedAt: sql`now()`,
          },
        });
    },

    /**
     * Writes a batch of embeddings with one UNNEST-based update. The arrays
     * are bound as parameters, so the SQL text stays fixed instead of growing
     * with the batch; only the parameter payload scales. One statement is
     * atomic, and a partial run simply leaves the remaining rows pending for
     * the next pass.
     */
    async updateChunkEmbeddings(input: {
      updates: ChunkEmbeddingUpdate[];
      space: EmbeddingSpace;
    }) {
      const { updates, space } = input;
      if (updates.length === 0) return;
      const ids = updates.map((u) => u.id);
      const embeddings = updates.map((u) => vectorLiteral(u.embedding));
      const hashes = updates.map((u) => u.contentHash);

      await client.execute(sql`
        update ${commitChunks} as c
        set embedding = v.embedding::vector,
            embedding_provider = ${space.provider},
            embedding_model = ${space.model},
            content_hash = v.content_hash,
            embedding_hash = v.content_hash,
            updated_at = now()
        from unnest(
          ${sql.param(ids)}::text[],
          ${sql.param(embeddings)}::text[],
          ${sql.param(hashes)}::text[]
        ) as v(id, embedding, content_hash)
        where c.id = v.id::uuid
      `);
    },

    async countChunksForProject(input: {
      projectId: string;
      branch?: string;
      embeddingSpace?: EmbeddingSpace;
    }): Promise<number> {
      const conditions = [eq(commitChunks.projectId, input.projectId)];
      if (input.branch) conditions.push(eq(commitChunks.branch, input.branch));
      if (input.embeddingSpace) {
        conditions.push(
          isNotNull(commitChunks.embedding),
          eq(commitChunks.embeddingHash, commitChunks.contentHash),
          eq(commitChunks.embeddingProvider, input.embeddingSpace.provider),
          eq(commitChunks.embeddingModel, input.embeddingSpace.model),
        );
      }
      const [row] = await client
        .select({ count: sql<number>`count(*)::int` })
        .from(commitChunks)
        .where(and(...conditions));
      return row?.count ?? 0;
    },

    async getLatestCommitDate(input: {
      projectId: string;
      branch?: string;
    }): Promise<Date | null> {
      const conditions = [eq(commitChunks.projectId, input.projectId)];
      if (input.branch) conditions.push(eq(commitChunks.branch, input.branch));
      const [row] = await client
        .select({ committedAt: commitChunks.committedAt })
        .from(commitChunks)
        .where(and(...conditions))
        .orderBy(desc(commitChunks.committedAt))
        .limit(1);
      return row?.committedAt ?? null;
    },

    async getChunksByShas(input: {
      projectId: string;
      shas: string[];
      branch?: string;
    }): Promise<
      Map<string, { commitSha: string; metadata: CommitChunkMetadata; contentHash: string | null }>
    > {
      if (input.shas.length === 0) return new Map();
      const conditions = [
        eq(commitChunks.projectId, input.projectId),
        inArray(commitChunks.commitSha, input.shas),
      ];
      if (input.branch) conditions.push(eq(commitChunks.branch, input.branch));
      const rows = await client
        .select({
          commitSha: commitChunks.commitSha,
          metadata: commitChunks.metadata,
          contentHash: commitChunks.contentHash,
        })
        .from(commitChunks)
        .where(and(...conditions));
      return new Map(rows.map((r) => [r.commitSha, { ...r, metadata: r.metadata ?? {} }]));
    },

    async listCommitsForProject(input: {
      projectId: string;
      startDate?: Date;
      endDate?: Date;
      branch?: string;
    }) {
      const conditions = [eq(commitChunks.projectId, input.projectId)];
      if (input.startDate) conditions.push(gte(commitChunks.committedAt, input.startDate));
      if (input.endDate) conditions.push(lte(commitChunks.committedAt, input.endDate));
      if (input.branch) conditions.push(eq(commitChunks.branch, input.branch));
      return client
        .select()
        .from(commitChunks)
        .where(and(...conditions))
        .orderBy(desc(commitChunks.committedAt));
    },

    async listPendingChunks(projectId: string, space: EmbeddingSpace) {
      return client
        .select({
          id: commitChunks.id,
          commitMessage: commitChunks.commitMessage,
          committedAt: commitChunks.committedAt,
          contentHash: commitChunks.contentHash,
        })
        .from(commitChunks)
        .where(
          and(
            eq(commitChunks.projectId, projectId),
            or(
              isNull(commitChunks.embeddingHash),
              ne(commitChunks.embeddingHash, commitChunks.contentHash),
              isNull(commitChunks.embeddingProvider),
              ne(commitChunks.embeddingProvider, space.provider),
              isNull(commitChunks.embeddingModel),
              ne(commitChunks.embeddingModel, space.model),
            ),
          ),
        );
    },

    async listProjectIdsWithChunks(): Promise<string[]> {
      const rows = await client
        .selectDistinct({ projectId: commitChunks.projectId })
        .from(commitChunks);
      return rows.map((row) => row.projectId);
    },

    /**
     * Vector search over the HNSW index. Orders by cosine distance ascending
     * (most similar first). Only current, same-space embeddings are eligible:
     * NULL embeddings, stale content hashes, and vectors from another model are
     * excluded.
     */
    async semanticSearchCommits(input: {
      projectId: string;
      embedding: number[];
      embeddingSpace: EmbeddingSpace;
      limit: number;
      branch?: string;
      startDate?: Date;
      endDate?: Date;
    }): Promise<CommitSearchResult[]> {
      const conditions = [
        eq(commitChunks.projectId, input.projectId),
        isNotNull(commitChunks.embedding),
        eq(commitChunks.embeddingHash, commitChunks.contentHash),
        eq(commitChunks.embeddingProvider, input.embeddingSpace.provider),
        eq(commitChunks.embeddingModel, input.embeddingSpace.model),
      ];
      if (input.branch) conditions.push(eq(commitChunks.branch, input.branch));
      if (input.startDate) conditions.push(gte(commitChunks.committedAt, input.startDate));
      if (input.endDate) conditions.push(lte(commitChunks.committedAt, input.endDate));

      const rows = await client
        .select({
          id: commitChunks.id,
          commitSha: commitChunks.commitSha,
          commitMessage: commitChunks.commitMessage,
          author: commitChunks.author,
          committedAt: commitChunks.committedAt,
          metadata: commitChunks.metadata,
          distance: cosineDistance(commitChunks.embedding, input.embedding),
        })
        .from(commitChunks)
        .where(and(...conditions))
        .orderBy(asc(cosineDistance(commitChunks.embedding, input.embedding)))
        .limit(input.limit);

      return rows.map((r) => ({
        ...r,
        metadata: r.metadata ?? {},
        distance: r.distance as number,
      }));
    },

    /**
     * Keyword fallback when no embeddings exist for a project (embedding
     * disabled or not yet backfilled). Matches the commit message or any file
     * path in scope.
     */
    async keywordSearchCommits(input: {
      projectId: string;
      query: string;
      limit: number;
      branch?: string;
      startDate?: Date;
      endDate?: Date;
    }): Promise<CommitSearchResult[]> {
      const pattern = `%${input.query.replace(/[%_]/g, "")}%`;
      const conditions = [
        eq(commitChunks.projectId, input.projectId),
        or(
          ilike(commitChunks.commitMessage, pattern),
          sql`${commitChunks.metadata}::text ILIKE ${pattern}`,
        ),
      ];
      if (input.branch) conditions.push(eq(commitChunks.branch, input.branch));
      if (input.startDate) conditions.push(gte(commitChunks.committedAt, input.startDate));
      if (input.endDate) conditions.push(lte(commitChunks.committedAt, input.endDate));

      const rows = await client
        .select({
          id: commitChunks.id,
          commitSha: commitChunks.commitSha,
          commitMessage: commitChunks.commitMessage,
          author: commitChunks.author,
          committedAt: commitChunks.committedAt,
          metadata: commitChunks.metadata,
        })
        .from(commitChunks)
        .where(and(...conditions))
        .orderBy(desc(commitChunks.committedAt))
        .limit(input.limit);

      return rows.map((r) => ({
        ...r,
        metadata: r.metadata ?? {},
        distance: null,
      }));
    },
  };
}

export const commitChunksStore = createCommitChunksStore();
