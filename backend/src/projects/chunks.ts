import type { Commit } from "@/shared/integrations/git-provider";
import type { CommitChunkMetadata } from "@/db/schema";

const MAX_SUMMARY_LENGTH = 6000;

export type CommitChunk = {
  commitSha: string;
  commitMessage: string;
  author: string;
  diffSummary: string;
  metadata: CommitChunkMetadata;
  committedAt: Date;
};

export function buildCommitChunks(commits: Commit[]): CommitChunk[] {
  return commits.map((commit) => ({
    commitSha: commit.sha,
    commitMessage: commit.message,
    author: commit.author,
    diffSummary: commit.message.trim().slice(0, MAX_SUMMARY_LENGTH),
    metadata: { commitUrl: commit.url },
    committedAt: new Date(commit.date),
  }));
  }
