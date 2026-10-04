CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "app_settings" RENAME COLUMN "report_provider" TO "chat_provider";
ALTER TABLE "app_settings" RENAME COLUMN "report_model" TO "chat_model";
DROP TABLE IF EXISTS "report_commits";
DROP TABLE IF EXISTS "report_jobs";
DROP TABLE IF EXISTS "reports";
