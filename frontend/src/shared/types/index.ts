import { Endpoints } from "@octokit/types";

export type GitHubRepository =
  Endpoints["GET /user/repos"]["response"]["data"][number];

export type GitHubCommit =
  Endpoints["GET /repos/{owner}/{repo}/commits"]["response"]["data"][number];

export type GitHubRepositoryClientPage = Pick<
  GitHubRepository,
  "id" | "name" | "full_name"
>;