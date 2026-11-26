import { timed } from "@/shared/timing";
import { commitUrl, type GitProviderId } from "@/shared/integrations/git-provider";
import {
  githubApiClient,
  type GithubApiClient,
} from "@/rag/github/github-api";
import {
  buildDiff,
  isExcludedPath,
  type CommitDiff,
  type CommitDiffFile,
} from "@/rag/git/commit-diff";
import type { CommitSource, SourceCommit } from "@/rag/indexing/source";

/**
 * Demo / serverless commit source: commits and file patches come from the
 * public GitHub REST API. No `git` binary, no disk.
 */
export function createApiCommitSource(
  opts: {
    gitProvider: GitProviderId;
    owner: string;
    repo: string;
    branch: string;
  },
  api: GithubApiClient = githubApiClient,
): CommitSource {
  const { gitProvider, owner, repo, branch } = opts;
  if (gitProvider !== "github") {
    throw new Error(`Demo mode does not support ${gitProvider} ingestion`);
  }

  return {
    async listCommits({ since, until }) {
      const commits = await timed(
        "ingestApi.listCommits",
        { owner, repo, branch },
        () => api.listCommits({ owner, repo, branch, since, until }),
      );
      return {
        commits: commits.map((commit) => ({
          ...commit,
          url: commit.url || commitUrl(gitProvider, owner, repo, commit.sha),
        })),
        tipSha: commits[0]?.sha ?? "",
      };
    },

    async readDiff(commit: SourceCommit): Promise<CommitDiff | null> {
      const filesBySha = await timed(
        "ingestApi.getCommitDiff",
        { owner, repo, sha: commit.sha },
        () =>
          api.getChangedFilesForShas({
            owner,
            repo,
            shas: [commit.sha],
          }),
      );
      const raw = filesBySha.get(commit.sha) ?? [];
      const filtered = raw.filter((file) => !isExcludedPath(file.filepath));
      if (filtered.length === 0) return null;

      const files: CommitDiffFile[] = filtered.map((file) => ({
        path: file.filepath,
        additions: file.additions,
        deletions: file.deletions,
        binary: file.binary,
      }));
      const patch = filtered
        .filter((file) => file.patch)
        .map(
          (file) =>
            `diff --git a/${file.filepath} b/${file.filepath}\n` +
            `--- a/${file.filepath}\n` +
            `+++ b/${file.filepath}\n` +
            `${file.patch}`,
        )
        .join("\n");

      return buildDiff(files, patch);
    },
  };
}
