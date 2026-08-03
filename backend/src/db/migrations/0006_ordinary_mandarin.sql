DROP INDEX "commit_project_sha_idx";--> statement-breakpoint
ALTER TABLE "commit_chunks" ADD COLUMN "branch" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "commit_project_sha_branch_idx" ON "commit_chunks" USING btree ("project_id","commit_sha","branch");