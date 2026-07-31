import type { Commit, CommitDetail, GitProvider } from "./git-provider";
import { buildDiffSummary } from "./diffs";

export type EnrichedCommit = Commit & { prBody: string | null; prNumber: number };

export type CommitChunk = {
  commitSha: string;
  commitMessage: string;
  author: string;
  diffSummary: string;
  metadata: {
    filesChanged?: string[];
    additions?: number;
    deletions?: number;
  };
  committedAt: Date;
};

export async function buildCommitChunks(
  provider: GitProvider,
  owner: string,
  repo: string,
  commits: EnrichedCommit[],
): Promise<CommitChunk[]> {
  const settled = await Promise.allSettled(
    commits.map((c) => provider.getCommitDetails(owner, repo, c.sha)),
  );

  return commits.map((commit, i) => {
    const detail = settled[i].status === "fulfilled" ? (settled[i] as PromiseFulfilledResult<CommitDetail | null>).value : null;
    return {
      commitSha: commit.sha,
      commitMessage: commit.message,
      author: commit.author,
      diffSummary: detail ? buildDiffSummary(detail) : commit.message,
      metadata: detail
        ? {
            filesChanged: detail.files.map((f) => f.filename),
            additions: detail.stats.additions,
            deletions: detail.stats.deletions,
          }
        : {},
      committedAt: new Date(commit.date),
    };
  });
}
