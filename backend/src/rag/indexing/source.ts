import type { CommitDiff } from "@/rag/git/commit-diff";

/** A commit as seen by a source, before the diff/summary pipeline runs. */
export type SourceCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  parentSha?: string | null;
  /** Provider commit URL when the source has one (API); git builds its own. */
  url?: string;
};

/**
 * A place commits come from. The source owns listing commits and reading the
 * diff for one commit; the orchestrator owns summaries, embeddings, and storage.
 */
export interface CommitSource {
  listCommits(opts: {
    since?: Date;
    until?: Date;
  }): Promise<{ commits: SourceCommit[]; tipSha: string }>;
  readDiff(commit: SourceCommit): Promise<CommitDiff | null>;
  /** Releases source-owned resources (e.g. the ephemeral git clone). */
  dispose?(): Promise<void>;
}
