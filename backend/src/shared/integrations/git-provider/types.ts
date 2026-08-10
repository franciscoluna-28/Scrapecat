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

export interface RepositoryFilters {
  type?: string;
  sort?: string;
  direction?: string;
  perPage?: number;
}

/**
 * One page of results from a paginated provider list endpoint.
 * `nextPage` is null when there is no further page to fetch.
 */
export interface Page<T> {
  items: T[];
  hasMore: boolean;
  nextPage: number | null;
}

export interface CommitParams {
  /** Page size. Providers cap this (GitHub max 100) — it is a page size, not a fetch limit. */
  perPage?: number;
  /** 1-based page index for the page-primitive (`listCommitsPage`). */
  page?: number;
  /** Hard cap on total items a bounded `listCommits` may return (0 = unlimited). */
  maxCommits?: number;
  /** Hard cap on pages a bounded `listCommits` may fetch (0 = unlimited). */
  maxPages?: number;
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
