CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "app_settings" ALTER COLUMN "chat_model" SET DEFAULT 'deepseek/deepseek-v4.1-flash';