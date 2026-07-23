import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import { env } from "../config/env";

const MyOctokit = Octokit.plugin(throttling, retry);

export const octokit = new MyOctokit({
  auth: env.GITHUB_TOKEN,
  throttle: {
    onRateLimit: (retryAfter: number, options: any, _client: any, retryCount: number) => {
      console.warn(`Rate limit hit for ${options.method} ${options.url}`);
      if (retryCount < 3) {
        console.info(`Retrying after ${retryAfter} seconds`);
        return true;
      }
      return false;
    },
    onSecondaryRateLimit: (_retryAfter: number, options: any, _client: any) => {
      console.warn(`Secondary rate limit for ${options.method} ${options.url}`);
    },
  },
  retry: { doNotRetry: [422] },
});

export async function getAllRepositories(config: Record<string, any> = {}) {
  const { data } = await octokit.request("GET /user/repos", {
    type: config.type || "public",
    sort: config.sort || "updated",
    direction: config.direction || "desc",
    per_page: config.per_page || 10,
  });
  return data;
}

export async function getRepositoryCommits(params: {
  owner: string; repo: string; per_page?: number; sha?: string; since?: string; until?: string;
}) {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/commits", {
    owner: params.owner, repo: params.repo,
    per_page: params.per_page || 30,
    sort: "created", direction: "desc",
    sha: params.sha, since: params.since, until: params.until,
  });
  return data;
}

export async function getRepositoryCommitCount(params: {
  owner: string; repo: string; since?: string; until?: string;
}): Promise<number> {
  try {
    const dateQuery = params.since && params.until
      ? `committer-date:${params.since}..${params.until}`
      : params.since ? `committer-date:>=${params.since}` : "";
    const query = dateQuery ? `repo:${params.owner}/${params.repo} ${dateQuery}` : `repo:${params.owner}/${params.repo}`;
    const { data } = await octokit.request("GET /search/commits", { q: query, per_page: 1 });
    return data.total_count;
  } catch {
    try {
      const commits = await getRepositoryCommits({
        owner: params.owner, repo: params.repo,
        per_page: 100, since: params.since, until: params.until,
      });
      return commits.length;
    } catch {
      return 0;
    }
  }
}

export async function getRepositoryBranches(owner: string, repo: string): Promise<string[]> {
  const { data } = await octokit.request("GET /repos/{owner}/{repo}/branches", {
    owner,
    repo,
    per_page: 100,
  });
  return data.map((branch: any) => branch.name);
}

export async function getPullRequestForCommit(owner: string, repo: string, commitSha: string) {
  try {
    const { data: prs } = await octokit.request(
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls",
      { owner, repo, commit_sha: commitSha, per_page: 1 },
    );
    const pr = prs?.[0];
    if (!pr) return null;
    return { body: pr.body ?? null, number: pr.number, html_url: pr.html_url };
  } catch {
    return null;
  }
}

export const demoOctokit = env.GITHUB_TOKEN
  ? new Octokit({ auth: env.GITHUB_TOKEN })
  : new Octokit();
