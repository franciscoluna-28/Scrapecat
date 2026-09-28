import { env } from "@/config/env";
import { createOctokit } from "@/shared/integrations/git-provider/octokit";

export type ApiCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
};

export type ApiFileChange = {
  filepath: string;
  status: string;
};

const PER_PAGE = 100;
const DEFAULT_MAX_COMMITS = 200;
const FILE_FETCH_CONCURRENCY = 6;

function client() {
  return createOctokit(env.GITHUB_TOKEN || null);
}

/**
 * Lists commits for a public repo branch straight from the GitHub REST API —
 * no `git` binary, no disk. Newest-first, capped at `max` commits.
 *
 * Public-only by design: these endpoints return private data only if the token
 * has access to it. In demo mode use a fine-grained PAT scoped to public
 * read-only so it structurally cannot see private repos.
 */
export async function listCommitsFromApi(opts: {
  owner: string;
  repo: string;
  branch: string;
  since?: Date;
  until?: Date;
  max?: number;
}): Promise<ApiCommit[]> {
  const { owner, repo, branch, since, until } = opts;
  const max = opts.max ?? DEFAULT_MAX_COMMITS;
  const sinceMs = since?.getTime();
  const untilMs = until?.getTime();
  const octokit = client();

  const out: ApiCommit[] = [];
  for (let page = 1; out.length < max; page++) {
    const { data } = await octokit.request("GET /repos/{owner}/{repo}/commits", {
      owner,
      repo,
      sha: branch,
      per_page: PER_PAGE,
      page,
    });
    if (!Array.isArray(data) || data.length === 0) break;

    let reachedLowerBound = false;
    for (const raw of data as any[]) {
      const dateStr = raw.commit?.author?.date ?? raw.commit?.committer?.date;
      if (!dateStr) continue;
      const date = new Date(dateStr);
      if (untilMs !== undefined && date.getTime() > untilMs) continue;
      if (sinceMs !== undefined && date.getTime() < sinceMs) {
        // Newest-first: everything from here on is older than the window.
        reachedLowerBound = true;
        break;
      }
      const message: string = raw.commit?.message ?? "";
      if (!message.trim()) continue;
      out.push({
        sha: raw.sha,
        message,
        author: raw.commit?.author?.name || raw.commit?.author?.email || "unknown",
        date: date.toISOString(),
        url: raw.html_url ?? `https://github.com/${owner}/${repo}/commit/${raw.sha}`,
      });
      if (out.length >= max) break;
    }

    if (reachedLowerBound) break;
    if (data.length < PER_PAGE) break;
  }

  return out;
}

/**
 * Best-effort file scopes for a set of commits (`GET /repos/:o/:r/commits/:sha`).
 * Skipped entirely when no token is configured — that endpoint costs one
 * request per commit and the anonymous 60/hr budget is too small for it.
 * Individual failures are swallowed so ingestion never fails on rate limits.
 */
export async function getChangedFilesForShas(opts: {
  owner: string;
  repo: string;
  shas: string[];
}): Promise<Map<string, ApiFileChange[]>> {
  const { owner, repo, shas } = opts;
  const result = new Map<string, ApiFileChange[]>();
  if (!env.GITHUB_TOKEN || shas.length === 0) return result;

  const octokit = client();
  let next = 0;
  const workers = Array.from(
    { length: Math.min(FILE_FETCH_CONCURRENCY, shas.length) },
    async () => {
      while (next < shas.length) {
        const sha = shas[next++];
        try {
          const { data } = await octokit.request(
            "GET /repos/{owner}/{repo}/commits/{ref}",
            { owner, repo, ref: sha },
          );
          const files = (data as any).files as any[] | undefined;
          if (Array.isArray(files)) {
            result.set(
              sha,
              files.map((f) => ({ filepath: f.filename, status: f.status })),
            );
          }
        } catch {
          // best-effort — a missing file scope is acceptable
        }
      }
    },
  );
  await Promise.all(workers);
  return result;
}
