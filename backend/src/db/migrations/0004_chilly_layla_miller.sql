CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE "github_projects" ADD COLUMN "github_owner" text DEFAULT '' NOT NULL;