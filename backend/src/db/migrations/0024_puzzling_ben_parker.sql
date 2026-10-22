CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "commit_chunks" ADD COLUMN "embedding_provider" text;--> statement-breakpoint
ALTER TABLE "commit_chunks" ADD COLUMN "embedding_model" text;