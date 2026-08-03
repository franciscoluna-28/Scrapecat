import type {
  Repository,
  Commit,
  RepositoryFilters,
  CommitParams,
  DateRangeParams,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";

export interface GitProvider {
  listRepositories(filters?: RepositoryFilters): Promise<Repository[]>;
  listBranches(owner: string, repo: string): Promise<string[]>;
  listCommits(owner: string, repo: string, params?: CommitParams): Promise<Commit[]>;
  countCommits(owner: string, repo: string, params?: DateRangeParams): Promise<number>;
  verifyConnection(): Promise<ConnectionStatus>;
}
