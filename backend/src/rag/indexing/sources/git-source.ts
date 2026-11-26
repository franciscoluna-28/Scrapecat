import type { GitProviderId } from "@/shared/integrations/git-provider";
import {
  gitRepositoryService,
  type GitRepositoryHandle,
} from "@/rag/git/git-repository-service";
import { classifyCommit } from "@/rag/indexing/guardrail";
import { type CommitChunkInput } from "@/rag/indexing/commit-chunks-store";
import type { CommitSource, SourceCommit, SourceContext } from "@/rag/indexing/source";

const BATCH_SIZE = 50;

/**
 * Self-hosted commit source: opens a throwaway git workspace, reads the commit
 * window with native `git log`, and derives each batch's file scopes through
 * the repository service. Callers must `dispose()` the source when the job ends.
 *
 * Guardrail runs here (and only here): empty/no-op commits are skipped and
 * uninformative or contradictory messages are flagged in `metadata.validation`.
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
    batchSize: BATCH_SIZE,

    async listCommits({ since, until }) {
      const active = await gitRepositoryService.open({
        gitProvider,
        owner,
        repo,
        branch,
      });
      repository = active;
      const commits = await active.listCommits({ since, until });
      return { commits, tipSha: active.tipSha };
    },

    async toChunkInputs(commits: SourceCommit[], ctx: SourceContext) {
      const active = requireRepository();
      const diffBySha = await active.changedFiles(commits.map((c) => c.sha));

      const inputs: CommitChunkInput[] = [];
      let skipped = 0;

      for (const c of commits) {
        const stats = diffBySha.get(c.sha);
        if (!stats) {
          skipped += 1;
          continue;
        }
        const guard = classifyCommit({ message: c.message, filesChanged: stats.filesChanged });
        if (guard.status === "skipped") {
          skipped += 1;
          continue;
        }
        inputs.push({
          projectId: ctx.projectId,
          commitSha: c.sha,
          branch: ctx.branch,
          commitMessage: c.message,
          author: c.author,
          metadata: {
            filesChanged: stats.files.map((f) => f.filepath),
            commitUrl: active.commitUrl(c.sha),
            validation: { status: guard.status, notes: guard.notes },
          },
          committedAt: new Date(c.date),
        });
      }

      return { inputs, skipped };
    },

    async dispose() {
      if (!repository) return;
      const active = repository;
      repository = null;
      await active.dispose();
    },
  };
}
