import type {
  Repository,
  Commit,
  PullRequest,
  RepositoryFilters,
  CommitParams,
  DateRangeParams,
  ConnectionStatus,
} from "./types";

export interface GitProvider {
  listRepositories(filters?: RepositoryFilters): Promise<Repository[]>;
  listBranches(owner: string, repo: string): Promise<string[]>;
  listCommits(owner: string, repo: string, params?: CommitParams): Promise<Commit[]>;
  countCommits(owner: string, repo: string, params?: DateRangeParams): Promise<number>;
  getPullRequestForCommit(owner: string, repo: string, commitSha: string): Promise<PullRequest | null>;
  verifyConnection(): Promise<ConnectionStatus>;
}
