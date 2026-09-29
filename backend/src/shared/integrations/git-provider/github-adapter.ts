import { createOctokit, type OctokitClient } from "@/shared/integrations/git-provider/octokit";
import type { GitProvider } from "@/shared/integrations/git-provider/provider";
import type {
  Repository,
  RepositoryFilters,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";

function toRepository(raw: any): Repository {
  return {
    id: String(raw.id),
    name: raw.name,
    full_name: raw.full_name,
    owner: { login: raw.owner?.login ?? "" },
    private: raw.private,
    description: raw.description ?? null,
    default_branch: raw.default_branch,
    updated_at: raw.updated_at,
    stargazers_count: raw.stargazers_count,
    forks_count: raw.forks_count,
  };
}

export class GithubAdapter implements GitProvider {
  private octokit: OctokitClient;

  constructor(token: string) {
    this.octokit = createOctokit(token);
  }

  async listRepositories(filters?: RepositoryFilters): Promise<Repository[]> {
    const { data } = await this.octokit.request("GET /user/repos", {
      type: filters?.type || "public" as any,
      sort: filters?.sort || "updated" as any,
      direction: filters?.direction || "desc" as any,
      per_page: filters?.perPage || 10,
    });
    return data.map(toRepository);
  }

  /**
   * Search public repositories without authentication. Used when no GitHub
   * token is configured so the demo still works with public repos.
   */
  async searchPublicRepositories(query: string, perPage = 10): Promise<Repository[]> {
    const unauthed = createOctokit(null);
    const { data } = await unauthed.request("GET /search/repositories", {
      q: `${query} is:public`,
      sort: "updated",
      order: "desc",
      per_page: perPage,
    });
    return (data.items || []).map(toRepository);
  }

  /**
   * Lists every branch of a repository, walking pages with a simple loop.
   * Discovery only — commits are read from the local archive, never the API.
   */
  async listBranches(owner: string, repo: string): Promise<string[]> {
    const branches: string[] = [];
    for (let page = 1; ; page++) {
      const { data } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/branches",
        { owner, repo, per_page: 100, page },
      );
      branches.push(...data.map((branch: any) => branch.name));
      if (data.length < 100) break;
    }
    return branches;
  }

  /**
   * Resolves the repository's default branch (e.g. `main`, `master`, `canary`).
   * Repos don't always have `main` — defaulting to a hardcoded branch name is a
   * bug (next.js's default is `canary`).
   */
  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const { data } = await this.octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    });
    return data.default_branch;
  }

  /**
   * The numeric repo id is the provider's stable identity: it never changes on
   * rename/transfer. We store it as `provider_project_id` so every creation path
   * (demo cards, repo list, URL) resolves to the same project row.
   */
  async getRepositoryId(owner: string, repo: string): Promise<string> {
    const { data } = await this.octokit.request("GET /repos/{owner}/{repo}", {
      owner,
      repo,
    });
    return String(data.id);
  }

  async verifyConnection(): Promise<ConnectionStatus> {
    const response = await this.octokit.request("GET /user", {
      headers: { "X-GitHub-Api-Version": "2022-11-28" },
    });
    const rateLimitRemaining = parseInt(
      response.headers["x-ratelimit-remaining"] as string,
      10,
    );
    return {
      login: response.data.login,
      rateLimitRemaining: isNaN(rateLimitRemaining) ? 5000 : rateLimitRemaining,
    };
  }
}
