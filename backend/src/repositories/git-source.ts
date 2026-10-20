import { timed } from "@/shared/timing";
import { commitUrl, type GitProviderId } from "@/shared/integrations/git-provider";
import { ensureArchive } from "@/repositories/archive-service";
import { listCommitsInRange } from "@/repositories/git-reader";
import { getCommitChangedFiles, type CommitChangedStats } from "@/repositories/git-diff";
import { classifyCommit } from "@/repositories/guardrail";
import { type CommitChunkInput } from "@/projects/stores/commit-chunks-store";
import type { CommitSource, SourceCommit, SourceContext } from "@/repositories/ingest";

const BATCH_SIZE = 50;
const WALK_CONCURRENCY = 8;

/**
 * Runs `fn` over `items` with at most `limit` promises in flight. The commit
 * file-scope reads shell out to the native git binary (async, non-blocking),
 * but spawning dozens of processes at once is still wasteful — a modest
 * concurrency bounds process count while keeping the loop responsive.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Self-hosted commit source: clones/fetches the local git archive, reads the
 * commit window with native `git log`, and derives each new commit's file scope
 * with `git diff-tree` — all off the event loop, bounded memory.
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
      const diffs = await mapLimit(commits, WALK_CONCURRENCY, async (c) => {
        const stats = await getCommitChangedFiles({
          dir: archiveDir,
          parentSha: c.parentSha ?? null,
          commitSha: c.sha,
        });
        return { sha: c.sha, stats } as const;
      });
      const diffBySha = new Map<string, { sha: string; stats: CommitChangedStats }>(
        diffs.map((d) => [d.sha, d]),
      );

      const inputs: CommitChunkInput[] = [];
      let skipped = 0;

      for (const c of commits) {
        const d = diffBySha.get(c.sha);
        if (!d) continue;
        const guard = classifyCommit({ message: c.message, filesChanged: d.stats.filesChanged });
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
            filesChanged: d.stats.files.map((f) => f.filepath),
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
