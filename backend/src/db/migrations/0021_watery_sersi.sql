CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "chat_sessions" ADD COLUMN "anonymous_id" text;
