import type {
  Repository,
  RepositoryFilters,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";

export interface GitProvider {
  listRepositories(filters?: RepositoryFilters): Promise<Repository[]>;
  listBranches(owner: string, repo: string): Promise<string[]>;
  getDefaultBranch(owner: string, repo: string): Promise<string>;
  /** The provider's stable numeric repository id (as a string). */
  getRepositoryId(owner: string, repo: string): Promise<string>;
  verifyConnection(): Promise<ConnectionStatus>;
}
