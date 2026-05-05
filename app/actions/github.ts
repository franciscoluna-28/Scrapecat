import { octokit } from "@/lib/octokit";
import { cacheTag } from "next/cache";
import { GITHUB_CACHE_TAGS } from "@/services/cache";
import { Endpoints } from "@octokit/types";

export type GitHubRepository =
  Endpoints["GET /user/repos"]["response"]["data"][number];

type GetAllRepositoriesParameters = Endpoints["GET /user/repos"]["parameters"];

export async function getAllRepositories(
  config: GetAllRepositoriesParameters = {},
): Promise<GitHubRepository[]> {
  "use cache";
  cacheTag(GITHUB_CACHE_TAGS.REPOSITORIES);

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
) {
  "use cache";
  cacheTag(`commits:${owner}:${repo}`);

  try {
    const { data } = await octokit.request(
      "GET /repos/{owner}/{repo}/commits",
      {
        owner,
        repo,
        per_page: limit,
        sort: "created",
        direction: "desc",
      },
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
  "use cache";
  cacheTag(`branches:${owner}:${repo}`);

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
  "use cache";
  cacheTag(`repository:${repoId}`);

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
