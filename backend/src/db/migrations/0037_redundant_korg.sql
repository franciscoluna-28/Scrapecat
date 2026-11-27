CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid,
	"job_type" text NOT NULL,
	"project_id" uuid,
	"branch" text,
	"status" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	"duration_ms" integer NOT NULL,
	"embedding_ms" integer,
	"commits_found" integer,
	"commits_written" integer,
	"commits_embedded" integer,
	"error_code" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_runs_job_id_idx" ON "ingestion_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "ingestion_runs_project_created_idx" ON "ingestion_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "ingestion_runs_type_created_idx" ON "ingestion_runs" USING btree ("job_type","created_at");