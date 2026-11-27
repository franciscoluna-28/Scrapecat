CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "commit_embeddings" ALTER COLUMN "summary" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "commit_embeddings" ALTER COLUMN "summary_version" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "commit_embeddings" ALTER COLUMN "summary_model" DROP NOT NULL;--> statement-breakpoint
-- LLM summaries are disabled for now; clear the old generated summaries and
-- rebuild the lexical vector from files + message only.
UPDATE "commit_embeddings"
SET "summary" = NULL, "summary_version" = NULL, "summary_model" = NULL;--> statement-breakpoint
UPDATE "commit_embeddings"
SET "search_vector" =
  setweight(to_tsvector('simple', coalesce(array_to_string(files_changed, ' '), '')), 'B') ||
  setweight(to_tsvector('english', coalesce(message, '')), 'C');