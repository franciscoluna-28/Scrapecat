-- Add 'ollama' to credential_provider enum
ALTER TYPE credential_provider ADD VALUE IF NOT EXISTS 'ollama';

-- Resize embedding vector from 512 to 768 dimensions
-- Existing embeddings will be zero-padded (re-embed for correct results)
ALTER TABLE commit_chunks ALTER COLUMN embedding TYPE vector(768);
