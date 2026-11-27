ALTER TABLE "ingestion_runs" ADD COLUMN IF NOT EXISTS "embedding_provider" text;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD COLUMN IF NOT EXISTS "embedding_model" text;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD COLUMN IF NOT EXISTS "embedding_input_tokens" integer;--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD COLUMN IF NOT EXISTS "embedding_output_tokens" integer;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'ingestion_runs'
      AND column_name = 'embedding_tokens'
  ) THEN
    UPDATE "ingestion_runs"
    SET "embedding_input_tokens" = "embedding_tokens"
    WHERE "embedding_input_tokens" IS NULL;

    UPDATE "ingestion_runs"
    SET "embedding_output_tokens" = 0
    WHERE "embedding_output_tokens" IS NULL
      AND "embedding_tokens" IS NOT NULL;

    ALTER TABLE "ingestion_runs" DROP COLUMN "embedding_tokens";
  END IF;
END $$;
