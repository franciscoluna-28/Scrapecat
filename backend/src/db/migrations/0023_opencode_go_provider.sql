CREATE EXTENSION IF NOT EXISTS vector;
ALTER TYPE "credential_provider" ADD VALUE IF NOT EXISTS 'ollama';
ALTER TYPE "credential_provider" ADD VALUE IF NOT EXISTS 'opencode-go';
