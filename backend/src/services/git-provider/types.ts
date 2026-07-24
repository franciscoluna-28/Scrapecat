export interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  description: string | null;
  default_branch: string;
  updated_at: string;
  stargazers_count?: number;
  forks_count?: number;
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  date: string;
  url?: string;
}

export interface PullRequest {
  body: string | null;
  number: number;
  url: string;
}

export interface RepositoryFilters {
  type?: string;
  sort?: string;
  direction?: string;
  perPage?: number;
}

export interface CommitParams {
  perPage?: number;
  branch?: string;
  since?: string;
  until?: string;
}

export interface DateRangeParams {
  since?: string;
  until?: string;
}

export interface ConnectionStatus {
  login: string;
  rateLimitRemaining: number;
}
