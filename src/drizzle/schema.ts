import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

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
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
