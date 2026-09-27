import { env } from "@/config/env";
import * as commitChunksStore from "@/projects/stores/commit-chunks-store";

const GITHUB_API = "https://api.github.com";
const MAX_COMMITS = 200;
const PER_PAGE = 100;

type ApiCommit = {
  sha: string;
  html_url?: string;
  commit?: {
    message?: string;
    author?: { name?: string; date?: string };
    committer?: { date?: string };
  };
};

export type ApiIngestResult = {
  commitsFound: number;
  chunksWritten: number;
  tipSha: string;
};

/**
 * Ingests commits for a branch via the GitHub REST API instead of a local git
 * archive. Used in demo/stateless deployments (e.g. Vercel serverless) where
 * the native `git` binary and persistent disk aren't available.
 *
 * Best-effort: capped history, no per-commit file diff (REST would need one
 * request per commit), so citations carry message/author/date but no file
 * scope. Dedupe by SHA like the archive path.
 */
export async function ingestCommitsFromApi(opts: {
  owner: string;
  repo: string;
  branch: string;
  projectId: string;
}): Promise<ApiIngestResult> {
  const { owner, repo, branch, projectId } = opts;
  const headers: Record<string, string> = { Accept: "application/vnd.github+json" };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;

  const commits: ApiCommit[] = [];
  let page = 1;
  while (commits.length < MAX_COMMITS) {
    const url = `${GITHUB_API}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(
      branch,
    )}&per_page=${PER_PAGE}&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      if (res.status === 404 || res.status === 422) {
        throw new Error("Branch or repository not found on GitHub");
      }
      throw new Error(`GitHub API error: ${res.status}`);
    }
    const data = (await res.json()) as ApiCommit[];
    if (!Array.isArray(data) || data.length === 0) break;
    commits.push(...data);
    if (data.length < PER_PAGE) break;
    page += 1;
  }

  const inputs = commits
    .map((c) => ({
      projectId,
      commitSha: c.sha,
      branch,
      commitMessage: c.commit?.message ?? "",
      author: c.commit?.author?.name ?? null,
      metadata: {
        commitUrl: c.html_url ?? `https://github.com/${owner}/${repo}/commit/${c.sha}`,
        filesChanged: [] as string[],
      },
      committedAt: new Date(
        c.commit?.author?.date ?? c.commit?.committer?.date ?? Date.now(),
      ),
    }))
    .filter((i) => i.commitMessage.trim().length > 0);

  const existing = await commitChunksStore.getChunksByShas({
    projectId,
    shas: inputs.map((i) => i.commitSha),
    branch,
  });
  const newInputs = inputs.filter((i) => !existing.has(i.commitSha));
  if (newInputs.length > 0) {
    await commitChunksStore.upsertCommitChunks({ inputs: newInputs });
  }

  return {
    commitsFound: inputs.length,
    chunksWritten: newInputs.length,
    tipSha: commits[0]?.sha ?? "",
  };
}