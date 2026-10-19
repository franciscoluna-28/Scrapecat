import { timed } from "@/shared/timing";
import { getChangedFilesForShas, listCommitsFromApi } from "@/repositories/github-api";
import { type CommitChunkInput } from "@/projects/stores/commit-chunks-store";
import type { CommitSource, SourceContext } from "@/repositories/ingest";

/**
 * Demo / serverless commit source: reads commits from the public GitHub REST
 * API via Octokit instead of a local `git` archive. No `git` binary, no
 * persistent disk — only Postgres and outbound HTTPS.
 *
 * Public repos only. File scopes are best-effort and use a single batch, so the
 * whole window upserts once (matching the previous API path). No guardrail runs
 * here — demo chunks carry no `metadata.validation`.
 */
export function createApiCommitSource(opts: {
  owner: string;
  repo: string;
  branch: string;
}): CommitSource {
  const { owner, repo, branch } = opts;

  return {
    batchSize: Infinity,

    async listCommits({ since, until }) {
      const commits = await timed("ingestApi.listCommits", { owner, repo, branch }, () =>
        listCommitsFromApi({ owner, repo, branch, since, until }),
      );
      return { commits, tipSha: commits[0]?.sha ?? "" };
    },

    async toChunkInputs(commits, ctx: SourceContext) {
      const filesBySha = await timed(
        "ingestApi.getChangedFiles",
        { owner, repo, branch, count: commits.length },
        () => getChangedFilesForShas({ owner, repo, shas: commits.map((c) => c.sha) }),
      );

      const inputs: CommitChunkInput[] = commits.map((c) => ({
        projectId: ctx.projectId,
        commitSha: c.sha,
        branch: ctx.branch,
        commitMessage: c.message,
        author: c.author,
        metadata: {
          filesChanged: (filesBySha.get(c.sha) ?? []).map((f) => f.filepath),
          commitUrl: c.url ?? `https://github.com/${owner}/${repo}/commit/${c.sha}`,
        },
        committedAt: new Date(c.date),
      }));

      return { inputs, skipped: 0 };
    },
  };
}
