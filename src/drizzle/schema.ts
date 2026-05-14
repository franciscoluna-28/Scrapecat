import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { ProcessedCommit } from "../shared/lib/utils";

/**
 * Stores AI-generated business reports for GitHub repositories
 * Each report contains both original and editable versions
 */
export const reports = sqliteTable("reports", {
  id: text("id").primaryKey(),
  githubProjectId: integer("github_project_id").notNull(), // GitHub repository ID
  githubRepositoryName: text("github_repository_name").notNull(),
  originalMarkdown: text("original_markdown").notNull(), // Non-editable LLM output
  editableMarkdown: text("editable_markdown").notNull(), // User-editable version
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  branch: text("branch").notNull(),
  sourceCommits: text("source_commits", { mode: "json" }).$type<
    ProcessedCommit[]
  >(), // Audit & compliance. GitHub commits are huge so we're storing the processed version keeping the SHA and essential info.
  sourceCommitsUpdatedAt: integer("source_commits_updated_at", {
    mode: "timestamp",
  }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  customInstructions: text("custom_instructions"),
});
