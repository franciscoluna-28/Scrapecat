CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TYPE "public"."git_provider" AS ENUM('github', 'gitlab');
--> statement-breakpoint
ALTER TABLE "github_projects" RENAME TO "projects";--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "github_project_id" TO "provider_project_id";--> statement-breakpoint
ALTER TABLE "projects" RENAME COLUMN "github_owner" TO "provider_owner";--> statement-breakpoint
ALTER TABLE "projects" DROP CONSTRAINT "github_projects_github_project_id_unique";--> statement-breakpoint
ALTER TABLE "commit_chunks" DROP CONSTRAINT "commit_chunks_project_id_github_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "project_sync_state" DROP CONSTRAINT "project_sync_state_project_id_github_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "reports_project_id_github_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "sync_jobs" DROP CONSTRAINT "sync_jobs_project_id_github_projects_id_fk";
--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "git_provider" "git_provider" DEFAULT 'github' NOT NULL;--> statement-breakpoint
ALTER TABLE "commit_chunks" ADD CONSTRAINT "commit_chunks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_sync_state" ADD CONSTRAINT "project_sync_state_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_git_provider_project_id_idx" ON "projects" USING btree ("git_provider","provider_project_id");