import {
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const AVAILABLE_CREDENTIAL_PROVIDERS = [
  "openai",
  "openrouter",
  "deepseek",
  "github",
  "gitlab",
] as const;

const credentialProviderEnum = pgEnum(
  "credential_provider",
  AVAILABLE_CREDENTIAL_PROVIDERS,
);

export const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
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
  additions?: number;
  deletions?: number;
  commitUrl?: string;
  prNumber?: number;
  prTitle?: string;
  prUrl?: string;
};

export const githubProjects = pgTable("github_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubProjectId: integer("github_project_id").notNull().unique(),
  githubOwner: text("github_owner").default("").notNull(),
  repositoryName: text("repository_name").notNull(),
  defaultBranch: text("default_branch").default("main").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const commitChunks = pgTable(
  "commit_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => githubProjects.id, { onDelete: "cascade" })
      .notNull(),
    commitSha: text("commit_sha").notNull(),
    branch: text("branch").notNull().default("main"),
    commitMessage: text("commit_message").notNull(),
    author: text("author"),
    diffSummary: text("diff_summary").notNull(),
    embedding: vector("embedding"),
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

export const projectSyncState = pgTable(
  "project_sync_state",
  {
    projectId: uuid("project_id")
      .references(() => githubProjects.id, { onDelete: "cascade" })
      .notNull(),
    branch: text("branch").notNull(),
    lastSyncedCommitSha: text("last_synced_commit_sha").notNull(),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.projectId, table.branch] }),
  }),
);

export const reports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => githubProjects.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  originalMarkdown: text("original_markdown").notNull(),
  editableMarkdown: text("editable_markdown").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  branch: text("branch").notNull(),
  customInstructions: text("custom_instructions"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const reportCommits = pgTable(
  "report_commits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    reportId: uuid("report_id")
      .references(() => reports.id, { onDelete: "cascade" })
      .notNull(),
    commitSha: text("commit_sha").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    reportCommitUnique: uniqueIndex("report_commit_unique_idx").on(
      table.reportId,
      table.commitSha,
    ),
    reportIdIdx: index("report_commits_report_id_idx").on(table.reportId),
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

export type CredentialProvider = (typeof credentialProviderEnum)["enumValues"][number];
