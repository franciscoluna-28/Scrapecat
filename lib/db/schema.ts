import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

/**
 * Stores information about projects
 * Each project is linked to a GitHub repository
 */
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  repositoryId: integer("repository_id").notNull().unique(),
  repositoryFullName: text("repository_full_name").notNull(),
  repositoryDescription: text("description"),
  aiInstructions: text("ai_instructions"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
