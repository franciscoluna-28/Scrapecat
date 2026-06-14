import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { ProcessedCommit } from "../shared/lib/utils";

export type ImageAsset = {
  originalUrl: string;
  r2Url: string;
  commitSha: string;
  commitMessage: string;
};

/**
 * Stores AI-generated business reports for GitHub repositories
 * Each report contains both original and editable versions
 */
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  githubProjectId: integer("github_project_id").notNull(),
  githubRepositoryName: text("github_repository_name").notNull(),
  originalMarkdown: text("original_markdown").notNull(),
  editableMarkdown: text("editable_markdown").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  branch: text("branch").notNull(),
  sourceCommits: text("source_commits", { mode: "json" }).$type<ProcessedCommit[]>(),
  sourceCommitsUpdatedAt: integer("source_commits_updated_at", { mode: "timestamp" }).notNull(),
  imageAssets: text("image_assets", { mode: "json" }).$type<ImageAsset[]>(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  customInstructions: text("custom_instructions"),
});
