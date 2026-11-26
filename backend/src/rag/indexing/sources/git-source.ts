import type { GitProviderId } from "@/shared/integrations/git-provider";
import {
  gitRepositoryService,
  type GitRepositoryHandle,
} from "@/rag/git/git-repository-service";
import type { CommitDiff } from "@/rag/git/commit-diff";
import type { CommitSource, SourceCommit } from "@/rag/indexing/source";

/**
 * Self-hosted commit source: opens a throwaway git workspace and exposes the
 * commit window plus a diff reader. Callers must `dispose()` the source when
 * the job ends.
 */
export function createGitCommitSource(opts: {
  gitProvider: GitProviderId;
  owner: string;
  repo: string;
  branch: string;
}): CommitSource {
  const { gitProvider, owner, repo, branch } = opts;
  let repository: GitRepositoryHandle | null = null;

  function requireRepository(): GitRepositoryHandle {
    if (!repository) throw new Error("Repository workspace is not open");
    return repository;
  }

  return {
    async listCommits({ since, until }) {
      const active = await gitRepositoryService.open({
        gitProvider,
        owner,
        repo,
        branch,
      });
      repository = active;
      const commits = await active.listCommits({ since, until });
      return {
        commits: commits.map((commit) => ({
          ...commit,
          url: active.commitUrl(commit.sha),
        })),
        tipSha: active.tipSha,
      };
    },

    async readDiff(commit: SourceCommit): Promise<CommitDiff | null> {
      return requireRepository().diff({
        sha: commit.sha,
        parentSha: commit.parentSha ?? null,
      });
    },

    async dispose() {
      if (!repository) return;
      const active = repository;
      repository = null;
      await active.dispose();
    },
  };
}
