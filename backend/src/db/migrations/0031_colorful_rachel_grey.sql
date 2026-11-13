CREATE EXTENSION IF NOT EXISTS vector;
CREATE INDEX "commit_project_branch_committed_at_idx" ON "commit_chunks" USING btree ("project_id","branch","committed_at");