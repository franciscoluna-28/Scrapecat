import { env } from "@/shared/config/env";
import { createOctokit, type OctokitClient } from "@/shared/integrations/git-provider/octokit";
import { commitUrl } from "@/shared/integrations/git-provider/urls";

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

export type ListCommitsOptions = {
  owner: string;
  repo: string;
  branch: string;
  since?: Date;
  until?: Date;
  max?: number;
};

export type GetChangedFilesOptions = {
  owner: string;
  repo: string;
  shas: string[];
};

export type GithubApiClient = {
  listCommits(opts: ListCommitsOptions): Promise<ApiCommit[]>;
  getChangedFilesForShas(
    opts: GetChangedFilesOptions,
  ): Promise<Map<string, ApiFileChange[]>>;
};

type GithubApiDeps = {
  octokit: Pick<OctokitClient, "request">;
  token: string | null;
};

const PER_PAGE = 100;
const DEFAULT_MAX_COMMITS = 200;
const FILE_FETCH_CONCURRENCY = 6;

const token = env.GITHUB_TOKEN || null;
const defaultDeps: GithubApiDeps = {
  octokit: createOctokit(token),
  token,
};

/**
 * GitHub REST client for the demo/serverless indexing path. No `git` binary and
 * no disk: commits and file scopes come straight from the API.
 *
 * Public-only by design. In demo mode use a fine-grained PAT scoped to public
 * read-only so GitHub itself prevents access to private repos.
 */
export function createGithubApiClient(
  overrides: Partial<GithubApiDeps> = {},
): GithubApiClient {
  const deps = { ...defaultDeps, ...overrides };

  async function listCommits(opts: ListCommitsOptions): Promise<ApiCommit[]> {
    const { owner, repo, branch, since, until } = opts;
    const max = opts.max ?? DEFAULT_MAX_COMMITS;
    const sinceMs = since?.getTime();
    const untilMs = until?.getTime();

    const out: ApiCommit[] = [];
    for (let page = 1; out.length < max; page++) {
      const { data } = await deps.octokit.request(
        "GET /repos/{owner}/{repo}/commits",
        { owner, repo, sha: branch, per_page: PER_PAGE, page },
      );
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
          author:
            raw.commit?.author?.name || raw.commit?.author?.email || "unknown",
          date: date.toISOString(),
          url: raw.html_url ?? commitUrl("github", owner, repo, raw.sha),
        });
        if (out.length >= max) break;
      }

      if (reachedLowerBound) break;
      if (data.length < PER_PAGE) break;
    }

    return out;
  }

  /**
   * Best-effort file scopes for a set of commits. Skipped entirely when no
   * token is configured: this costs one request per commit and the anonymous
   * 60/hr budget is too small. Individual failures are swallowed so indexing
   * never fails on rate limits.
   */
  async function getChangedFilesForShas(
    opts: GetChangedFilesOptions,
  ): Promise<Map<string, ApiFileChange[]>> {
    const { owner, repo, shas } = opts;
    const result = new Map<string, ApiFileChange[]>();
    if (!deps.token || shas.length === 0) return result;

    let next = 0;
    const workers = Array.from(
      { length: Math.min(FILE_FETCH_CONCURRENCY, shas.length) },
      async () => {
        while (next < shas.length) {
          const sha = shas[next++];
          try {
            const { data } = await deps.octokit.request(
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

  return { listCommits, getChangedFilesForShas };
}

export const githubApiClient = createGithubApiClient();
