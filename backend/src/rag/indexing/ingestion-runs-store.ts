import { and, desc, eq, getTableColumns, gte, sql } from "drizzle-orm";
import { db, type DbOrTx } from "@/db/client";
import {
  ingestionRuns,
  projects,
  type GitProvider,
  type IngestionRunRow,
  type IngestionRunType,
} from "@/db/schema";

export type IngestionRunInput = typeof ingestionRuns.$inferInsert;

export type IngestionRunView = IngestionRunRow & {
  repositoryName: string | null;
  providerOwner: string | null;
  gitProvider: GitProvider | null;
};

export type IngestionRunSummary = {
  runs: number;
  failedRuns: number;
  commitsProcessed: number;
  embeddingsProcessed: number;
  avgDurationMs: number | null;
  embeddingInputTokens: number | null;
  embeddingOutputTokens: number | null;
};

export type IngestionRunFilters = {
  projectId?: string;
  jobType?: IngestionRunType;
};

const runColumns = getTableColumns(ingestionRuns);
const projectColumns = {
  repositoryName: projects.repositoryName,
  providerOwner: projects.providerOwner,
  gitProvider: projects.gitProvider,
};

function whereClause(input: IngestionRunFilters) {
  const conditions = [];
  if (input.projectId) {
    conditions.push(eq(ingestionRuns.projectId, input.projectId));
  }
  if (input.jobType) {
    conditions.push(eq(ingestionRuns.jobType, input.jobType));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export function createIngestionRunsStore(client: DbOrTx = db) {
  return {
    async record(input: IngestionRunInput): Promise<void> {
      await client.insert(ingestionRuns).values(input);
    },

    async listRecent(
      input: { limit: number } & IngestionRunFilters,
    ): Promise<IngestionRunView[]> {
      return client
        .select({ ...runColumns, ...projectColumns })
        .from(ingestionRuns)
        .leftJoin(projects, eq(projects.id, ingestionRuns.projectId))
        .where(whereClause(input))
        .orderBy(desc(ingestionRuns.startedAt))
        .limit(input.limit);
    },

    async summarizeSince(
      input: { since: Date } & IngestionRunFilters,
    ): Promise<IngestionRunSummary> {
      const since = gte(ingestionRuns.startedAt, input.since);
      const filters = whereClause(input);

      const [row] = await client
        .select({
          runs: sql<number>`(count(*))::int`,
          failedRuns: sql<number>`(count(*) filter (where ${ingestionRuns.status} = 'failed'))::int`,
          commitsProcessed: sql<number>`coalesce(sum(${ingestionRuns.commitsWritten}), 0)::int`,
          embeddingsProcessed: sql<number>`coalesce(sum(${ingestionRuns.commitsEmbedded}), 0)::int`,
          avgDurationMs: sql<number | null>`avg(${ingestionRuns.durationMs})::float8`,
          embeddingInputTokens: sql<number | null>`(
            case
              when count(*) = 0 then null
              when count(*) filter (where ${ingestionRuns.embeddingInputTokens} is null) > 0 then null
              else coalesce(sum(${ingestionRuns.embeddingInputTokens}), 0)
            end
          )::int`,
          embeddingOutputTokens: sql<number | null>`(
            case
              when count(*) = 0 then null
              when count(*) filter (where ${ingestionRuns.embeddingOutputTokens} is null) > 0 then null
              else coalesce(sum(${ingestionRuns.embeddingOutputTokens}), 0)
            end
          )::int`,
        })
        .from(ingestionRuns)
        .where(filters ? and(since, filters) : since);

      return {
        runs: row?.runs ?? 0,
        failedRuns: row?.failedRuns ?? 0,
        commitsProcessed: row?.commitsProcessed ?? 0,
        embeddingsProcessed: row?.embeddingsProcessed ?? 0,
        avgDurationMs: row?.avgDurationMs ?? null,
        embeddingInputTokens: row?.embeddingInputTokens ?? null,
        embeddingOutputTokens: row?.embeddingOutputTokens ?? null,
      };
    },
  };
}

export type IngestionRunsStore = ReturnType<typeof createIngestionRunsStore>;

export const ingestionRunsStore = createIngestionRunsStore();
