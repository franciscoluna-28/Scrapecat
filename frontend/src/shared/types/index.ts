import type { paths } from "@/src/shared/api/types";

export type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  updated_at: string;
  owner: { login: string };
  stargazers_count?: number;
  forks_count?: number;
};

export type GitHubRepositoryClientPage = Pick<
  GitHubRepository,
  "id" | "name" | "full_name"
>;

export type ImageAsset = {
  originalUrl: string;
  r2Url: string;
  commitSha: string;
  commitMessage: string;
};

export type ProcessedCommit =
  paths["/api/v1/reports"]["post"]["requestBody"]["content"]["application/json"]["data"]["commits"][number];