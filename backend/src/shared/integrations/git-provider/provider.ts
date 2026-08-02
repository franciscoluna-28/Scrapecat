import type {
  Repository,
  Commit,
  CommitDetail,
  PullRequest,
  RepositoryFilters,
  CommitParams,
  DateRangeParams,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";

export interface GitProvider {
  listRepositories(filters?: RepositoryFilters): Promise<Repository[]>;
  listBranches(owner: string, repo: string): Promise<string[]>;
  listCommits(owner: string, repo: string, params?: CommitParams): Promise<Commit[]>;
  getCommitDetails(owner: string, repo: string, sha: string): Promise<CommitDetail | null>;
  countCommits(owner: string, repo: string, params?: DateRangeParams): Promise<number>;
  getPullRequestForCommit(owner: string, repo: string, commitSha: string): Promise<PullRequest | null>;
  verifyConnection(): Promise<ConnectionStatus>;
}
