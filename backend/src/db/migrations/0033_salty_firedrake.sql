CREATE TABLE "project_branches" (
	"project_id" uuid NOT NULL,
	"branch" text NOT NULL,
	"tip_sha" text NOT NULL,
	"last_commit_at" timestamp with time zone,
	"last_ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_branches_project_id_branch_pk" PRIMARY KEY("project_id","branch")
);
--> statement-breakpoint
ALTER TABLE "project_branches" ADD CONSTRAINT "project_branches_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;