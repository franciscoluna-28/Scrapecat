import { octokit } from "@/src/shared/lib/octokit";
import { Endpoints } from "@octokit/types";
import { GitHubCommit, GitHubRepository } from "../types";

// It's better to use provider (Octokit, OAS 3.0) types instead of hardcoding parameters
type GetAllRepositoriesParameters = Endpoints["GET /user/repos"]["parameters"];
type GetRepositoryCommitsParameters =
  Endpoints["GET /repos/{owner}/{repo}/commits"]["parameters"];

export async function getAllRepositories(
  config: GetAllRepositoriesParameters = {},
): Promise<GitHubRepository[]> {
  const { data } = await octokit.request("GET /user/repos", {
    type: config.type || "public",
    sort: config.sort || "updated",
    direction: config.direction || "desc",
    per_page: config.per_page || 10,
  });

  return data;
}

export async function getRepositoryCommits(
  params: GetRepositoryCommitsParameters,
): Promise<GitHubCommit[]> {
  try {
    const requestParams: {
      owner: string;
      repo: string;
      per_page: number;
      sort: string;
      direction: string;
      sha?: string;
      since?: string;
      until?: string;
    } = {
      owner: params.owner,
      repo: params.repo,
      per_page: params.per_page || 30,
      sort: "created",
      direction: "desc",
    };

    if (params.sha) {
      requestParams.sha = params.sha;
    }
    if (params.since) {
      requestParams.since = params.since;
    }
    if (params.until) {
      requestParams.until = params.until;
    }

    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/commits",
      requestParams,
    );

    return data;
  } catch (error) {
    console.error(
      `Error fetching commits for ${params.owner}/${params.repo}:`,
      error,
    );
    throw error;
  }
}

export async function getRepositoryBranches(
  owner: string,
  repo: string,
): Promise<string[]> {
  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/branches",
      {
        owner,
        repo,
        per_page: 100,
      },
    );

    return data.map((branch) => branch.name);
  } catch (error) {
    console.error(`Error fetching branches for ${owner}/${repo}:`, error);
    throw error;
  }
}

export async function getRepositoryById(
  repoId: number,
): Promise<GitHubRepository | null> {
  try {
    const { data } = await octokit.request("GET /user/repos", {
      per_page: 100,
    });

    const repository = data.find((repo) => repo.id === repoId);
    return repository || null;
  } catch (error) {
    console.error(`Error fetching repository ${repoId}:`, error);
    return null;
  }
}

type GetRepositoryCommitCountParameters = {
  owner: string;
  repo: string;
  since?: string;
  until?: string;
};

/**
 * Get the total count of commits for a repository within a date range
 * Uses GitHub's search API for efficient counting
 * Created to improve the report creation settings performance
 */
export async function getRepositoryCommitCount({
  owner,
  repo,
  since,
  until,
}: GetRepositoryCommitCountParameters): Promise<number> {
  try {
    const dateQuery =
      since && until
        ? `committer-date:${since}..${until}`
        : since
          ? `committer-date:>=${since}`
          : "";

    const query = dateQuery
      ? `repo:${owner}/${repo} ${dateQuery}`
      : `repo:${owner}/${repo}`;

    const { data } = await octokit.request("GET /search/commits", {
      q: query,
      per_page: 1, // 1 commit because we only need total_count
    });

    return data.total_count;
  } catch (error) {
    console.error(`Error fetching commit count for ${owner}/${repo}:`, error);
    try {
      // Fallback to getRepositoryCommits if search API fails
      const commits = await getRepositoryCommits({
        owner,
        repo,
        per_page: 100,
        since,
        until,
      });
      return commits.length;
    } catch {
      return 0;
    }
  }
}

/**
 * Fetches the associated PR for a commit using the commits/pulls endpoint.
 * Avoids the Search API (30 req/min limit) — uses the standard rate limit (5000/hr).
 * For merge commits and PR head commits this reliably returns the associated PR.
 */
export async function getPullRequestForCommit(
  owner: string,
  repo: string,
  commitSha: string,
): Promise<{ body: string | null; number: number; html_url: string } | null> {
  try {
    const { data: prs } = await octokit.request(
      "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls",
      { owner, repo, commit_sha: commitSha, per_page: 1 },
    );
    const pr = prs?.[0];
    if (!pr) return null;
    return { body: pr.body ?? null, number: pr.number, html_url: pr.html_url };
  } catch (err) {
    console.error(`getPullRequestForCommit error for ${commitSha.slice(0, 7)}:`, err);
    return null;
  }
}
