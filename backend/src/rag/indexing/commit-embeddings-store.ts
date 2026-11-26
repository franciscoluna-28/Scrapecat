import {
  and,
  asc,
  cosineDistance,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import {
  commitEmbeddings,
  type CommitEmbeddingRow,
} from "@/db/schema";
import type { EmbeddingSpace } from "@/rag/indexing/embeddings";

export type EmbeddingWrite = {
  vector: number[];
  provider: string;
  model: string;
};

export type CommitEmbeddingInput = {
  repoId: string;
  branch: string;
  commitSha: string;
  author: string | null;
  committedAt: Date;
  message: string;
  commitUrl: string;
  filesChanged: string[];
  diffHash: string;
  summary: string;
  summaryVersion: string;
  summaryModel: string;
  contentHash: string;
  embedding?: EmbeddingWrite;
};

export type CommitDocument = {
  repoId: string;
  branch: string;
  commitSha: string;
  author: string | null;
  committedAt: Date;
  message: string;
  commitUrl: string;
  filesChanged: string[];
  summary: string;
  distance: number | null;
};

export type CommitKey = {
  repoId: string;
  branch: string;
  commitSha: string;
};

const documentColumns = {
  repoId: commitEmbeddings.repoId,
  branch: commitEmbeddings.branch,
  commitSha: commitEmbeddings.commitSha,
  author: commitEmbeddings.author,
  committedAt: commitEmbeddings.committedAt,
  message: commitEmbeddings.message,
  commitUrl: commitEmbeddings.commitUrl,
  filesChanged: commitEmbeddings.filesChanged,
  summary: commitEmbeddings.summary,
};

function toDocument(
  row: Omit<CommitDocument, "distance">,
  distance: number | null = null,
): CommitDocument {
  return { ...row, distance };
}

export function createCommitEmbeddingsStore(client: DbOrTx = db) {
  return {
    async getByKey(key: CommitKey): Promise<CommitEmbeddingRow | null> {
      const [row] = await client
        .select()
        .from(commitEmbeddings)
        .where(
          and(
            eq(commitEmbeddings.repoId, key.repoId),
            eq(commitEmbeddings.branch, key.branch),
            eq(commitEmbeddings.commitSha, key.commitSha),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    /** Cross-branch reuse: same commit content and summary derivation. */
    async findReusableSummary(input: {
      repoId: string;
      commitSha: string;
      diffHash: string;
      summaryVersion: string;
      summaryModel?: string;
      excludeBranch: string;
    }): Promise<CommitEmbeddingRow | null> {
      const conditions = [
        eq(commitEmbeddings.repoId, input.repoId),
        eq(commitEmbeddings.commitSha, input.commitSha),
        eq(commitEmbeddings.diffHash, input.diffHash),
        eq(commitEmbeddings.summaryVersion, input.summaryVersion),
        ne(commitEmbeddings.branch, input.excludeBranch),
      ];
      if (input.summaryModel) {
        conditions.push(eq(commitEmbeddings.summaryModel, input.summaryModel));
      }
      const [row] = await client
        .select()
        .from(commitEmbeddings)
        .where(and(...conditions))
        .orderBy(desc(commitEmbeddings.updatedAt))
        .limit(1);
      return row ?? null;
    },

    async upsertCommit(input: CommitEmbeddingInput): Promise<void> {
      const embedding = input.embedding;
      const embeddingValues = embedding
        ? {
            embedding: embedding.vector,
            embeddingProvider: embedding.provider,
            embeddingModel: embedding.model,
            embeddingHash: input.contentHash,
          }
        : {};
      const embeddingUpdate = embedding
        ? {
            embedding: sql`excluded.embedding`,
            embeddingProvider: sql`excluded.embedding_provider`,
            embeddingModel: sql`excluded.embedding_model`,
            embeddingHash: sql`excluded.embedding_hash`,
          }
        : {};

      await client
        .insert(commitEmbeddings)
        .values({
          repoId: input.repoId,
          branch: input.branch,
          commitSha: input.commitSha,
          author: input.author,
          committedAt: input.committedAt,
          message: input.message,
          commitUrl: input.commitUrl,
          filesChanged: input.filesChanged,
          diffHash: input.diffHash,
          summary: input.summary,
          summaryVersion: input.summaryVersion,
          summaryModel: input.summaryModel,
          contentHash: input.contentHash,
          ...embeddingValues,
        })
        .onConflictDoUpdate({
          target: [
            commitEmbeddings.repoId,
            commitEmbeddings.branch,
            commitEmbeddings.commitSha,
          ],
          set: {
            author: sql`excluded.author`,
            committedAt: sql`excluded.committed_at`,
            message: sql`excluded.message`,
            commitUrl: sql`excluded.commit_url`,
            filesChanged: sql`excluded.files_changed`,
            diffHash: sql`excluded.diff_hash`,
            summary: sql`excluded.summary`,
            summaryVersion: sql`excluded.summary_version`,
            summaryModel: sql`excluded.summary_model`,
            contentHash: sql`excluded.content_hash`,
            updatedAt: sql`now()`,
            ...embeddingUpdate,
          },
        });
    },

    async updateEmbedding(input: {
      key: CommitKey;
      embedding: EmbeddingWrite;
      contentHash: string;
    }): Promise<void> {
      await client
        .update(commitEmbeddings)
        .set({
          embedding: input.embedding.vector,
          embeddingProvider: input.embedding.provider,
          embeddingModel: input.embedding.model,
          contentHash: input.contentHash,
          embeddingHash: input.contentHash,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(commitEmbeddings.repoId, input.key.repoId),
            eq(commitEmbeddings.branch, input.key.branch),
            eq(commitEmbeddings.commitSha, input.key.commitSha),
          ),
        );
    },

    async listPendingEmbeddings(input: {
      repoId: string;
      space: EmbeddingSpace;
    }) {
      return client
        .select({
          repoId: commitEmbeddings.repoId,
          branch: commitEmbeddings.branch,
          commitSha: commitEmbeddings.commitSha,
          filesChanged: commitEmbeddings.filesChanged,
          summary: commitEmbeddings.summary,
          contentHash: commitEmbeddings.contentHash,
        })
        .from(commitEmbeddings)
        .where(
          and(
            eq(commitEmbeddings.repoId, input.repoId),
            or(
              isNull(commitEmbeddings.embedding),
              isNull(commitEmbeddings.embeddingHash),
              ne(commitEmbeddings.embeddingHash, commitEmbeddings.contentHash),
              isNull(commitEmbeddings.embeddingProvider),
              ne(commitEmbeddings.embeddingProvider, input.space.provider),
              isNull(commitEmbeddings.embeddingModel),
              ne(commitEmbeddings.embeddingModel, input.space.model),
            ),
          ),
        );
    },

    async listProjectIds(): Promise<string[]> {
      const rows = await client
        .selectDistinct({ repoId: commitEmbeddings.repoId })
        .from(commitEmbeddings);
      return rows.map((row) => row.repoId);
    },

    async countCommitsForProject(input: {
      repoId: string;
      branch?: string;
    }): Promise<number> {
      const conditions = [eq(commitEmbeddings.repoId, input.repoId)];
      if (input.branch) conditions.push(eq(commitEmbeddings.branch, input.branch));
      const [row] = await client
        .select({ count: sql<number>`count(*)::int` })
        .from(commitEmbeddings)
        .where(and(...conditions));
      return row?.count ?? 0;
    },

    async getLatestCommitDate(input: {
      repoId: string;
      branch?: string;
    }): Promise<Date | null> {
      const conditions = [eq(commitEmbeddings.repoId, input.repoId)];
      if (input.branch) conditions.push(eq(commitEmbeddings.branch, input.branch));
      const [row] = await client
        .select({ committedAt: commitEmbeddings.committedAt })
        .from(commitEmbeddings)
        .where(and(...conditions))
        .orderBy(desc(commitEmbeddings.committedAt))
        .limit(1);
      return row?.committedAt ?? null;
    },

    async listCommitsForProject(input: {
      repoId: string;
      branch?: string;
      startDate?: Date;
      endDate?: Date;
    }): Promise<CommitDocument[]> {
      const conditions = [eq(commitEmbeddings.repoId, input.repoId)];
      if (input.branch) conditions.push(eq(commitEmbeddings.branch, input.branch));
      if (input.startDate) {
        conditions.push(gte(commitEmbeddings.committedAt, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(commitEmbeddings.committedAt, input.endDate));
      }
      const rows = await client
        .select(documentColumns)
        .from(commitEmbeddings)
        .where(and(...conditions))
        .orderBy(desc(commitEmbeddings.committedAt));
      return rows.map((row) => toDocument(row));
    },

    async listCommitsInWindow(input: {
      repoId: string;
      branch?: string;
      startDate?: Date;
      endDate?: Date;
      limit: number;
    }): Promise<CommitDocument[]> {
      const conditions = [eq(commitEmbeddings.repoId, input.repoId)];
      if (input.branch) conditions.push(eq(commitEmbeddings.branch, input.branch));
      if (input.startDate) {
        conditions.push(gte(commitEmbeddings.committedAt, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(commitEmbeddings.committedAt, input.endDate));
      }
      const rows = await client
        .select(documentColumns)
        .from(commitEmbeddings)
        .where(and(...conditions))
        .orderBy(desc(commitEmbeddings.committedAt))
        .limit(input.limit);
      return rows.map((row) => toDocument(row));
    },

    async semanticSearchCommits(input: {
      repoId: string;
      embedding: number[];
      embeddingSpace: EmbeddingSpace;
      limit: number;
      branch?: string;
      startDate?: Date;
      endDate?: Date;
    }): Promise<CommitDocument[]> {
      const conditions = [
        eq(commitEmbeddings.repoId, input.repoId),
        isNotNull(commitEmbeddings.embedding),
        eq(commitEmbeddings.embeddingHash, commitEmbeddings.contentHash),
        eq(commitEmbeddings.embeddingProvider, input.embeddingSpace.provider),
        eq(commitEmbeddings.embeddingModel, input.embeddingSpace.model),
      ];
      if (input.branch) conditions.push(eq(commitEmbeddings.branch, input.branch));
      if (input.startDate) {
        conditions.push(gte(commitEmbeddings.committedAt, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(commitEmbeddings.committedAt, input.endDate));
      }

      const rows = await client
        .select({
          ...documentColumns,
          distance: cosineDistance(commitEmbeddings.embedding, input.embedding),
        })
        .from(commitEmbeddings)
        .where(and(...conditions))
        .orderBy(asc(cosineDistance(commitEmbeddings.embedding, input.embedding)))
        .limit(input.limit);

      return rows.map((row) => toDocument(row, row.distance as number));
    },

    async lexicalSearchCommits(input: {
      repoId: string;
      query: string;
      limit: number;
      branch?: string;
      startDate?: Date;
      endDate?: Date;
    }): Promise<CommitDocument[]> {
      const english = sql`websearch_to_tsquery('english', ${input.query})`;
      const simple = sql`websearch_to_tsquery('simple', ${input.query})`;
      const tsQuery = sql`(${english} || ${simple})`;
      const rank = sql`(ts_rank_cd(${commitEmbeddings.searchVector}, ${english}) + ts_rank_cd(${commitEmbeddings.searchVector}, ${simple}))`;

      const conditions = [
        eq(commitEmbeddings.repoId, input.repoId),
        sql`${commitEmbeddings.searchVector} @@ ${tsQuery}`,
      ];
      if (input.branch) conditions.push(eq(commitEmbeddings.branch, input.branch));
      if (input.startDate) {
        conditions.push(gte(commitEmbeddings.committedAt, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(commitEmbeddings.committedAt, input.endDate));
      }

      const rows = await client
        .select(documentColumns)
        .from(commitEmbeddings)
        .where(and(...conditions))
        .orderBy(desc(rank), desc(commitEmbeddings.committedAt))
        .limit(input.limit);

      return rows.map((row) => toDocument(row));
    },

    async getByShas(input: {
      repoId: string;
      branch?: string;
      shas: string[];
    }): Promise<Map<string, { summary: string; filesChanged: string[]; message: string }>> {
      const result = new Map<
        string,
        { summary: string; filesChanged: string[]; message: string }
      >();
      if (input.shas.length === 0) return result;

      const conditions = [
        eq(commitEmbeddings.repoId, input.repoId),
        inArray(commitEmbeddings.commitSha, input.shas),
      ];
      if (input.branch) conditions.push(eq(commitEmbeddings.branch, input.branch));

      const rows = await client
        .select({
          commitSha: commitEmbeddings.commitSha,
          summary: commitEmbeddings.summary,
          filesChanged: commitEmbeddings.filesChanged,
          message: commitEmbeddings.message,
        })
        .from(commitEmbeddings)
        .where(and(...conditions));

      for (const row of rows) {
        result.set(row.commitSha, {
          summary: row.summary,
          filesChanged: row.filesChanged,
          message: row.message,
        });
      }
      return result;
    },
  };
}

export const commitEmbeddingsStore = createCommitEmbeddingsStore();
