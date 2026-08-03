CREATE TABLE "report_commits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"commit_sha" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "report_commits" ADD CONSTRAINT "report_commits_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_commit_unique_idx" ON "report_commits" USING btree ("report_id","commit_sha");--> statement-breakpoint
CREATE INDEX "report_commits_report_id_idx" ON "report_commits" USING btree ("report_id");