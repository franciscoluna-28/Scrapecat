import { octokit } from "@/src/shared/lib/octokit";
import { Endpoints } from "@octokit/types";
import { GitHubCommit, GitHubRepository } from "../types";

type GetAllRepositoriesParameters = Endpoints["GET /user/repos"]["parameters"];

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

type GetRepositoryCommitsParameters = {
  owner: string;
  repo: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
};

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
      since?: string;
      until?: string;
    } = {
      owner: params.owner,
      repo: params.repo,
      per_page: params.limit || 30,
      sort: "created",
      direction: "desc",
    };

    if (params.startDate) {
      requestParams.since = params.startDate;
    }
    if (params.endDate) {
      requestParams.until = params.endDate;
    }

    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/commits",
      requestParams,
    );

    return data;
  } catch (error) {
    console.error(`Error fetching commits for ${params.owner}/${params.repo}:`, error);
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

    return data.map(branch => branch.name);
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

    const repository = data.find(repo => repo.id === repoId);
    return repository || null;
  } catch (error) {
    console.error(`Error fetching repository ${repoId}:`, error);
    return null;
  }
}

/**
 * Get the total count of commits for a repository within a date range
 * Uses GitHub's search API for efficient counting
 * Created to improve the report creation settings performance
 */
export async function getRepositoryCommitCount(
  owner: string,
  repo: string,
  startDate?: string,
  endDate?: string,
): Promise<number> {
  try {
    // Build search query for date range
    const dateQuery = startDate && endDate
      ? `committer-date:${startDate}..${endDate}`
      : startDate
        ? `committer-date:>=${startDate}`
        : "";

    const query = dateQuery
      ? `repo:${owner}/${repo} ${dateQuery}`
      : `repo:${owner}/${repo}`;

    const { data } = await octokit.request(
      "GET /search/commits",
      {
        q: query,
        per_page: 1, // 1 commit because we only need total_count
      },
    );

    return data.total_count;
  } catch (error) {
    console.error(`Error fetching commit count for ${owner}/${repo}:`, error);
    // Fallback: fetch actual commits and count
    try {
      const commits = await getRepositoryCommits({
        owner,
        repo,
        limit: 100,
        startDate,
        endDate,
      });
      return commits.length;
    } catch {
      return 0;
    }
  }
}
