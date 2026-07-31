import {
  customType,
  index,
  integer as pgInteger,
  jsonb,
  pgTable,
  text as pgText,
  timestamp,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

const AVAILABLE_CREDENTIAL_PROVIDERS = [
  "ai_openai",
  "ai_openrouter",
  "ai_deepseek",
  "git_github",
  "git_gitlab",
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
    return `[${value.join(",")}]`; // Formato string nativo de pgvector
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .map(Number);
  },
});

export type ImageAsset = {
  originalUrl: string;
  r2Url: string;
  commitSha: string;
  commitMessage: string;
};

export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  githubProjectId: integer("github_project_id").notNull(),
  githubRepositoryName: text("github_repository_name").notNull(),
  originalMarkdown: text("original_markdown").notNull(),
  editableMarkdown: text("editable_markdown").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  branch: text("branch").notNull(),
  sourceCommits: text("source_commits", { mode: "json" }).$type<any[]>(),
  sourceCommitsUpdatedAt: integer("source_commits_updated_at", {
    mode: "timestamp",
  }).notNull(),
  imageAssets: text("image_assets", { mode: "json" }).$type<ImageAsset[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  customInstructions: text("custom_instructions"),
});

export const credentials = sqliteTable("credentials", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  name: text("name").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  keyHint: text("key_hint").notNull(),
  modalities: text("modalities", { mode: "json" })
    .$type<string[]>()
    .default(["language"]),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const pgGithubProjects = pgTable("github_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  githubProjectId: pgInteger("github_project_id").notNull().unique(),
  repositoryName: pgText("repository_name").notNull(),
  defaultBranch: pgText("default_branch").default("main").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pgCommitChunks = pgTable(
  "commit_chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    projectId: uuid("project_id")
      .references(() => pgGithubProjects.id, { onDelete: "cascade" })
      .notNull(),
    commitSha: pgText("commit_sha").notNull(),
    commitMessage: pgText("commit_message").notNull(),
    author: pgText("author"),
    diffSummary: pgText("diff_summary").notNull(),
    embedding: vector("embedding"),
    metadata: jsonb("metadata")
      .$type<{
        filesChanged?: string[];
        additions?: number;
        deletions?: number;
      }>()
      .default({}),
    committedAt: timestamp("committed_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      projectShaIdx: index("commit_project_sha_idx").on(
        table.projectId,
        table.commitSha,
      ),
      embeddingIdx: index("commit_embedding_hnsw_idx").using(
        "hnsw",
        table.embedding.op("vector_cosine_ops"),
      ),
    };
  },
);

export const pgReports = pgTable("reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => pgGithubProjects.id, { onDelete: "cascade" })
    .notNull(),
  title: pgText("title").notNull(),
  originalMarkdown: pgText("original_markdown").notNull(),
  editableMarkdown: pgText("editable_markdown").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }).notNull(),
  endDate: timestamp("end_date", { withTimezone: true }).notNull(),
  branch: pgText("branch").notNull(),
  customInstructions: pgText("custom_instructions"),
  imageAssets: jsonb("image_assets")
    .$type<
      {
        originalUrl: string;
        r2Url: string;
        commitSha: string;
        commitMessage: string;
      }[]
    >()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const pgCredentials = pgTable("credentials", {
  id: uuid("id").defaultRandom().primaryKey(),
  provider: credentialProviderEnum("provider").notNull(),
  name: pgText("name").notNull().unique(),
  encryptedKey: pgText("encrypted_key").notNull(),
  keyHint: pgText("key_hint").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
