CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
ALTER TABLE "commit_chunks" ADD COLUMN "content_hash" text;--> statement-breakpoint
ALTER TABLE "commit_chunks" ADD COLUMN "embedding_hash" text;--> statement-breakpoint
ALTER TABLE "commit_chunks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;