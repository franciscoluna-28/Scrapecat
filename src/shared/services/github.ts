import { octokit } from "@/src/shared/lib/octokit";
import { Endpoints } from "@octokit/types";
import { GitHubCommit, GitHubRepository } from "../types";

type GetAllRepositoriesParameters = Endpoints["GET /user/repos"]["parameters"];

export async function getAllRepositories(
  config: GetAllRepositoriesParameters = {},
): Promise<GitHubRepository[]> {

  const { data } = await octokit.request("GET /user/repos", {
    type: config.type || "private",
    sort: config.sort || "updated",
    direction: config.direction || "desc",
    per_page: config.per_page || 10,
  });

  return data;
}

export async function getRepositoryCommits(
  owner: string,
  repo: string,
  limit: number = 30,
  startDate?: string,
  endDate?: string,
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
      owner,
      repo,
      per_page: limit,
      sort: "created",
      direction: "desc",
    };

    if (startDate) {
      requestParams.since = startDate;
    }
    if (endDate) {
      requestParams.until = endDate;
    }

    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/commits",
      requestParams,
    );

    return data;
  } catch (error) {
    console.error(`Error fetching commits for ${owner}/${repo}:`, error);
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
