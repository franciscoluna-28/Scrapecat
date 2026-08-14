import type {
  Repository,
  Commit,
  RepositoryFilters,
  CommitParams,
  DateRangeParams,
  Page,
  ConnectionStatus,
  RepositoryArchive,
} from "@/shared/integrations/git-provider/types";

export interface GitProvider {
  listRepositories(filters?: RepositoryFilters): Promise<Repository[]>;
  listBranches(owner: string, repo: string): Promise<string[]>;
  listCommitsPage(owner: string, repo: string, params?: CommitParams): Promise<Page<Commit>>;
  listCommits(owner: string, repo: string, params?: CommitParams): Promise<Commit[]>;
  countCommits(owner: string, repo: string, params?: DateRangeParams): Promise<number>;
  verifyConnection(): Promise<ConnectionStatus>;
  downloadRepositoryArchive(owner: string, repo: string, ref: string): Promise<RepositoryArchive>;
}
