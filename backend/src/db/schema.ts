import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  jsonb,
  pgEnum,
  pgTable,
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

export type CommitChunkMetadata = {
  filesChanged?: string[];
  fileStats?: {
    filepath: string;
    status: "added" | "deleted" | "modified";
    additions: number;
    deletions: number;
  }[];
  additions?: number;
  deletions?: number;
  commitUrl?: string;
  prNumber?: number;
  prTitle?: string;
  prUrl?: string;
  summary?: { model?: string; at?: string };
  validation?: {
    status?: "confirmed" | "flagged" | "skipped";
    notes?: string[];
  };
};

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

export const commitChunks = pgTable(
  "commit_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => projects.id, { onDelete: "cascade" })
      .notNull(),
    commitSha: text("commit_sha").notNull(),
    branch: text("branch").notNull().default("main"),
    commitMessage: text("commit_message").notNull(),
    author: text("author"),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    embeddingProvider: text("embedding_provider"),
    embeddingModel: text("embedding_model"),
    contentHash: text("content_hash"),
    embeddingHash: text("embedding_hash"),
    metadata: jsonb("metadata")
      .$type<CommitChunkMetadata>()
      .default({}),
    committedAt: timestamp("committed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => {
    return {
      projectShaIdx: uniqueIndex("commit_project_sha_branch_idx").on(
        table.projectId,
        table.commitSha,
        table.branch,
      ),
      embeddingIdx: index("commit_embedding_hnsw_idx").using(
        "hnsw",
        table.embedding.op("vector_cosine_ops"),
      ),
    };
  },
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

export type ReportScheduleRow = typeof reportSchedules.$inferSelect;
export type ReportRow = typeof reports.$inferSelect;
export type CredentialProvider = (typeof credentialProviderEnum)["enumValues"][number];
