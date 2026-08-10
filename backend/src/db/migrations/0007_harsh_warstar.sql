CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "project_sync_state" (
	"project_id" uuid NOT NULL,
	"branch" text NOT NULL,
	"last_synced_commit_sha" text NOT NULL,
	"last_synced_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_sync_state_project_id_branch_pk" PRIMARY KEY("project_id","branch")
);
--> statement-breakpoint
ALTER TABLE "project_sync_state" ADD CONSTRAINT "project_sync_state_project_id_github_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."github_projects"("id") ON DELETE cascade ON UPDATE no action;