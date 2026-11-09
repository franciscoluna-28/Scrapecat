CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD COLUMN "hour_local" smallint DEFAULT 9 NOT NULL;--> statement-breakpoint
ALTER TABLE "report_schedules" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
UPDATE "report_schedules" SET "hour_local" = "hour_utc";