import { timed } from "@/shared/timing";
import { commitUrl, type GitProviderId } from "@/shared/integrations/git-provider";
import { ensureArchive } from "@/rag/git/archive-service";
import { listCommitsInRange } from "@/rag/git/git-reader";
import { getCommitsChangedFiles } from "@/rag/git/git-diff";
import { classifyCommit } from "@/rag/indexing/guardrail";
import { type CommitChunkInput } from "@/rag/indexing/commit-chunks-store";
import type { CommitSource, SourceCommit, SourceContext } from "@/rag/indexing/source";

const BATCH_SIZE = 50;

/**
 * Self-hosted commit source: clones/fetches the local git archive, reads the
 * commit window with native `git log`, and derives each batch's file scopes in a
 * single `git diff-tree --stdin` process — all off the event loop, bounded memory.
 *
 * Guardrail runs here (and only here): empty/no-op commits are skipped and
 * uninformative or contradictory messages are flagged in `metadata.validation`.
 */
export function createGitCommitSource(opts: {
  gitProvider: GitProviderId;
  owner: string;
  repo: string;
  branch: string;
  jobId?: string;
}): CommitSource {
  const { gitProvider, owner, repo, branch, jobId } = opts;
  let archiveDir = "";

  return {
    batchSize: BATCH_SIZE,

    async listCommits({ since, until }) {
      const archive = await timed("ingest.ensureArchive", { owner, repo, branch }, () =>
        ensureArchive({ gitProvider, owner, repo, branch, jobId }),
      );
      archiveDir = archive.dir;

      const commits = await timed(
        "ingest.listCommitsInRange",
        { owner, repo, branch, since: since?.toISOString(), until: until?.toISOString() },
        () =>
          listCommitsInRange({
            dir: archive.dir,
            ref: branch,
            since,
            until,
          }),
      );

      return { commits, tipSha: archive.tipSha };
    },

    async toChunkInputs(commits: SourceCommit[], ctx: SourceContext) {
      const diffBySha = await timed(
        "ingest.getChangedFiles",
        { owner, repo, branch, count: commits.length },
        () =>
          getCommitsChangedFiles({
            dir: archiveDir,
            shas: commits.map((c) => c.sha),
          }),
      );

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
            commitUrl: commitUrl(gitProvider, ctx.owner, ctx.repo, c.sha),
            validation: { status: guard.status, notes: guard.notes },
          },
          committedAt: new Date(c.date),
        });
      }

      return { inputs, skipped };
    },
  };
}
