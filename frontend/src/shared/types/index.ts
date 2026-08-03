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

export type ProcessedCommit =
  paths["/api/v1/repositories/{owner}/{repo}/commits"]["get"]["responses"]["200"]["content"]["application/json"]["commits"][number];

export type GitHubProject =
  paths["/api/v1/projects"]["get"]["responses"]["200"]["content"]["application/json"]["projects"][number];

export type StoredCommit =
  paths["/api/v1/reports/{id}/commits"]["get"]["responses"]["200"]["content"]["application/json"]["commits"][number];

export type ReportSummary =
  paths["/api/v1/reports"]["get"]["responses"]["200"]["content"]["application/json"]["reports"][number];

export type ReportDetail =
  paths["/api/v1/reports/{id}"]["get"]["responses"]["200"]["content"]["application/json"];
