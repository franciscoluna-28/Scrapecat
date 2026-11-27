import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { EMBEDDING_DIMENSIONS } from "@/shared/utils";

const AVAILABLE_CREDENTIAL_PROVIDERS = [
  "openai",
  "openrouter",
  "groq",
  "deepseek",
  "opencode-go",
  "ollama",
  "github",
  "gitlab",
] as const;

const credentialProviderEnum = pgEnum(
  "credential_provider",
  AVAILABLE_CREDENTIAL_PROVIDERS,
);

const AVAILABLE_GIT_PROVIDERS = ["github", "gitlab"] as const;

const gitProviderEnum = pgEnum("git_provider", AVAILABLE_GIT_PROVIDERS);

export type GitProvider = (typeof gitProviderEnum)["enumValues"][number];

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return `vector(${EMBEDDING_DIMENSIONS})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`; 
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gitProvider: gitProviderEnum("git_provider").default("github").notNull(),
    providerProjectId: text("provider_project_id").notNull(),
    providerOwner: text("provider_owner").default("").notNull(),
    repositoryName: text("repository_name").notNull(),
    defaultBranch: text("default_branch").default("main").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // The same external id can exist across providers (GitHub 123 vs GitLab 123).
    providerExternalIdIdx: uniqueIndex("projects_git_provider_project_id_idx").on(
      table.gitProvider,
      table.providerProjectId,
    ),
  }),
);

export const projectBranches = pgTable(
  "project_branches",
  {
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    branch: text("branch").notNull(),
    tipSha: text("tip_sha").notNull(),
    lastCommitAt: timestamp("last_commit_at", { withTimezone: true }),
    lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.branch] }),
  }),
);

export const commitEmbeddings = pgTable(
  "commit_embeddings",
  {
    repoId: uuid("repo_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    branch: text("branch").notNull(),
    commitSha: text("commit_sha").notNull(),
    author: text("author"),
    committedAt: timestamp("committed_at", { withTimezone: true }).notNull(),
    message: text("message").notNull(),
    commitUrl: text("commit_url").notNull(),
    filesChanged: text("files_changed")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    diffHash: text("diff_hash").notNull(),
    summary: text("summary"),
    summaryVersion: text("summary_version"),
    summaryModel: text("summary_model"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingProvider: text("embedding_provider"),
    embeddingModel: text("embedding_model"),
    contentHash: text("content_hash"),
    embeddingHash: text("embedding_hash"),
    // Postgres full-text index over summary (A), file paths (B), and the
    // original message (C), backing the lexical retrieval channel. Kept as a
    // normal column because generated columns require immutable expressions
    // and `array_to_string(files_changed, ' ')` is not immutable; the store
    // writes it in the same upsert as the summary.
    searchVector: tsvector("search_vector"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.repoId, table.branch, table.commitSha] }),
    repoCommitIdx: index("commit_embeddings_repo_commit_idx").on(
      table.repoId,
      table.commitSha,
    ),
    windowIdx: index("commit_embeddings_repo_branch_committed_at_idx").on(
      table.repoId,
      table.branch,
      table.committedAt,
    ),
    embeddingIdx: index("commit_embeddings_hnsw_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    searchVectorIdx: index("commit_embeddings_search_vector_gin_idx").using(
      "gin",
      table.searchVector,
    ),
  }),
);

export const credentials = pgTable(
  "credentials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: credentialProviderEnum("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    keyHint: text("key_hint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    providerUnique: uniqueIndex("credentials_provider_unique").on(table.provider),
  }),
);

export type ChatCitation = {
  commitSha: string;
  commitMessage: string;
  summary?: string;
  author: string | null;
  committedAt: string;
  filesChanged: string[];
  commitUrl: string | null;
};

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").default("New chat").notNull(),
    anonymousId: text("anonymous_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index("chat_sessions_project_id_idx").on(table.projectId),
  }),
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .references(() => chatSessions.id, { onDelete: "cascade" })
      .notNull(),
    role: text("role").notNull(),
    content: text("content").notNull(),
    branch: text("branch"),
    citations: jsonb("citations")
      .$type<ChatCitation[]>()
      .default([]),
    // Client-generated id for the logical turn. Unique per (session, role) so a
    // retried send can be deduped with ON CONFLICT DO NOTHING instead of
    // creating a second turn.
    clientMessageId: text("client_message_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("chat_messages_session_id_idx").on(table.sessionId),
    clientMessageIdIdx: uniqueIndex("chat_messages_client_id_idx")
      .on(table.sessionId, table.role, table.clientMessageId)
      .where(sql`${table.clientMessageId} is not null`),
  }),
);

export const appSettings = pgTable("app_settings", {
  id: text("id").primaryKey(),
  chatProvider: text("chat_provider").default("openrouter").notNull(),
  chatModel: text("chat_model").default("nvidia/nemotron-3-ultra-550b-a55b:free").notNull(),
  embeddingProvider: text("embedding_provider").default("openrouter").notNull(),
  embeddingModel: text("embedding_model").default("openai/text-embedding-3-small").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reportSchedules = pgTable(
  "report_schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    branch: text("branch").notNull(),
    cadence: text("cadence").default("daily").notNull(),
    dayOfWeek: smallint("day_of_week").default(5).notNull(),
    hour: smallint("hour_local").default(9).notNull(),
    timezone: text("timezone").default("UTC").notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastStatus: text("last_status").default("idle").notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectBranchIdx: uniqueIndex("report_schedules_project_branch_idx").on(
      table.projectId,
      table.branch,
    ),
    dueIdx: index("report_schedules_due_idx").on(table.enabled, table.nextRunAt),
  }),
);

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    branch: text("branch").notNull(),
    summary: text("summary").notNull(),
    sourceCommits: jsonb("source_commits")
      .$type<ChatCitation[]>()
      .default([])
      .notNull(),
    provider: text("provider"),
    model: text("model"),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectBranchCreatedIdx: index("reports_project_branch_created_idx").on(
      table.projectId,
      table.branch,
      table.createdAt,
    ),
    createdIdx: index("reports_created_idx").on(table.createdAt),
  }),
);

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type JobProgress = {
  stage: string;
  message: string;
  done?: number;
  total?: number;
};

export type JobError = {
  message: string;
  code?: string;
};

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: text("type").notNull(),
    status: text("status").$type<JobStatus>().default("queued").notNull(),
    payload: jsonb("payload").$type<unknown>().default({}).notNull(),
    result: jsonb("result").$type<unknown>(),
    progress: jsonb("progress").$type<JobProgress>(),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    runAt: timestamp("run_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    error: jsonb("error").$type<JobError>(),
    // Only one queued/running job may hold a key; terminal rows are archived
    // and a later enqueue with the same key starts a fresh job.
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dueIdx: index("jobs_status_run_at_idx").on(table.status, table.runAt),
    activeKeyIdx: uniqueIndex("jobs_active_idempotency_key_idx")
      .on(table.idempotencyKey)
      .where(
        sql`${table.idempotencyKey} is not null and ${table.status} in ('queued', 'running')`,
      ),
  }),
);

export type IngestionRunType = "ingest-branch" | "reindex-embeddings";

export type IngestionRunStatus = "succeeded" | "failed";

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    // Null for serverless inline runs, which have no durable jobs row, and
    // after the jobs row is pruned.
    jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
    jobType: text("job_type").$type<IngestionRunType>().notNull(),
    // Null once the project is deleted; history outlives discovery data.
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    // Null for the global reindex-embeddings run.
    branch: text("branch"),
    status: text("status").$type<IngestionRunStatus>().notNull(),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull(),
    durationMs: integer("duration_ms").notNull(),
    gitMs: integer("git_ms"),
    dbMs: integer("db_ms"),
    embeddingMs: integer("embedding_ms"),

    // Null when the run fails before producing a result.
    commitsFound: integer("commits_found"),
    commitsWritten: integer("commits_written"),
    commitsEmbedded: integer("commits_embedded"),

    // Embedding space and billed tokens for this run, split by direction.
    // Null when any provider response omitted usage.
    embeddingProvider: text("embedding_provider"),
    embeddingModel: text("embedding_model"),
    embeddingInputTokens: integer("embedding_input_tokens"),
    embeddingOutputTokens: integer("embedding_output_tokens"),

    errorCode: text("error_code"),
    errorMessage: text("error_message"),

    // Append-only: rows are inserted when a run ends, never updated.
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    jobIdIdx: index("ingestion_runs_job_id_idx").on(table.jobId),
    projectCreatedIdx: index("ingestion_runs_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
    typeCreatedIdx: index("ingestion_runs_type_created_idx").on(
      table.jobType,
      table.createdAt,
    ),
  }),
);

export type ReportScheduleRow = typeof reportSchedules.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type IngestionRunRow = typeof ingestionRuns.$inferSelect;
export type ProjectBranchRow = typeof projectBranches.$inferSelect;
export type CommitEmbeddingRow = typeof commitEmbeddings.$inferSelect;
export type CredentialProvider = (typeof credentialProviderEnum)["enumValues"][number];
