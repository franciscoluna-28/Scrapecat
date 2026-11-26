CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
DROP TABLE "commit_chunks" CASCADE;
--> statement-breakpoint
-- The new read model is diff/summary based; clear branch sync so every branch
-- re-ingests from full history on the next run.
DELETE FROM "project_branches";