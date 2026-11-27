DROP TABLE "commit_chunks" CASCADE;
--> statement-breakpoint
-- The read model is now diff/summary based; force a full re-ingest.
DELETE FROM "project_branches";