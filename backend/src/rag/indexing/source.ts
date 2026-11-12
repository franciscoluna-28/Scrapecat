import type { CommitChunkInput } from "@/rag/indexing/commit-chunks-store";

/** A commit as seen by a source, before file scope / guardrail are applied. */
export type SourceCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  parentSha?: string | null;
  /** Provider commit URL when the source has one (API); git builds its own. */
  url?: string;
};

export type SourceContext = {
  owner: string;
  repo: string;
  branch: string;
  projectId: string;
};

/**
 * A place commits come from. The orchestrator (`ingestCommits` in `ingest.ts`)
 * owns the common pipeline — dedupe by SHA, batched upsert, embedding, progress,
 * logging — while each source owns only how commits are listed and turned into
 * chunk rows.
 *
 * The source-specific parts are deliberate and preserved:
 * - `listCommits` also resolves the source's own `tipSha`.
 * - `toChunkInputs` owns file-scope fetching and (git-only) guardrail.
 * - `batchSize` controls upsert granularity: 50 for git, unbounded for the API
 *   path (a single upsert, matching its previous behavior).
 *
 * Sources live in `indexing/sources/` and depend on `rag/git` or `rag/github`;
 * this contract depends on neither.
 */
export interface CommitSource {
  batchSize: number;
  listCommits(opts: {
    since?: Date;
    until?: Date;
  }): Promise<{ commits: SourceCommit[]; tipSha: string }>;
  toChunkInputs(
    commits: SourceCommit[],
    ctx: SourceContext,
  ): Promise<{ inputs: CommitChunkInput[]; skipped: number }>;
}
