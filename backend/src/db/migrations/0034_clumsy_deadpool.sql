CREATE TABLE "commit_embeddings" (
	"repo_id" uuid NOT NULL,
	"branch" text NOT NULL,
	"commit_sha" text NOT NULL,
	"author" text,
	"committed_at" timestamp with time zone NOT NULL,
	"message" text NOT NULL,
	"commit_url" text NOT NULL,
	"files_changed" text[] DEFAULT '{}'::text[] NOT NULL,
	"diff_hash" text NOT NULL,
	"summary" text NOT NULL,
	"summary_version" text NOT NULL,
	"summary_model" text NOT NULL,
	"embedding" vector(768),
	"embedding_provider" text,
	"embedding_model" text,
	"content_hash" text,
	"embedding_hash" text,
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commit_embeddings_repo_id_branch_commit_sha_pk" PRIMARY KEY("repo_id","branch","commit_sha")
);
--> statement-breakpoint
ALTER TABLE "commit_embeddings" ADD CONSTRAINT "commit_embeddings_repo_id_projects_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commit_embeddings_repo_commit_idx" ON "commit_embeddings" USING btree ("repo_id","commit_sha");--> statement-breakpoint
CREATE INDEX "commit_embeddings_repo_branch_committed_at_idx" ON "commit_embeddings" USING btree ("repo_id","branch","committed_at");--> statement-breakpoint
CREATE INDEX "commit_embeddings_hnsw_idx" ON "commit_embeddings" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "commit_embeddings_search_vector_gin_idx" ON "commit_embeddings" USING gin ("search_vector");