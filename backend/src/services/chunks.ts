import type { Commit, GitProvider } from "./git-provider";
import type { CommitChunkMetadata } from "../db/schema";

const CONCURRENCY = 6;
const MAX_PR_BODY_CHARS = 2000;
const MAX_SUMMARY_LENGTH = 6000;

export type CommitChunk = {
  commitSha: string;
  commitMessage: string;
  author: string;
  diffSummary: string;
  metadata: CommitChunkMetadata;
  committedAt: Date;
};

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function composeSummary(commit: Commit, prTitle: string | null, prBody: string | null): string {
  const parts: string[] = [commit.message.trim()];
  if (prTitle && prTitle.trim() !== commit.message.trim()) {
    parts.push(prTitle.trim());
  }
  const body = prBody?.trim();
  if (body) {
    parts.push(body.slice(0, MAX_PR_BODY_CHARS));
  }
  return parts.join("\n\n").slice(0, MAX_SUMMARY_LENGTH);
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function buildCommitChunks(
  provider: GitProvider,
  owner: string,
  repo: string,
  commits: Commit[],
): Promise<CommitChunk[]> {
  return mapWithConcurrency(commits, CONCURRENCY, async (commit) => {
    const [pr, detail] = await Promise.all([
      safe(() => provider.getPullRequestForCommit(owner, repo, commit.sha)),
      safe(() => provider.getCommitDetails(owner, repo, commit.sha)),
    ]);

    const metadata: CommitChunkMetadata = {
      commitUrl: commit.url,
    };

    if (pr) {
      metadata.prNumber = pr.number;
      metadata.prTitle = pr.title || undefined;
      metadata.prUrl = pr.url;
    }

    if (detail) {
      metadata.filesChanged = detail.files.map((f) => f.filename);
      metadata.additions = detail.stats.additions;
      metadata.deletions = detail.stats.deletions;
    }

    return {
      commitSha: commit.sha,
      commitMessage: commit.message,
      author: commit.author,
      diffSummary: composeSummary(commit, pr?.title ?? null, pr?.body ?? null),
      metadata,
      committedAt: new Date(commit.date),
    };
  });
}
