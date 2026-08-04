import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import type { GitProvider } from "@/shared/integrations/git-provider/provider";
import { paginate } from "@/shared/integrations/git-provider/pagination";
import type {
  Repository,
  Commit,
  Page,
  RepositoryFilters,
  CommitParams,
  DateRangeParams,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";

const MyOctokit = Octokit.plugin(throttling, retry);

function createOctokit(token: string) {
  return new MyOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter: number, options: any, _client: any, retryCount: number) => {
        console.warn(`Rate limit hit for ${options.method} ${options.url}`);
        if (retryCount < 3) {
          console.info(`Retrying after ${retryAfter} seconds`);
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (_retryAfter: number, options: any, _client: any) => {
        console.warn(`Secondary rate limit for ${options.method} ${options.url}`);
      },
    },
    retry: { doNotRetry: [400, 401, 403, 404, 410, 422, 451] },
  });
}

function toRepository(raw: any): Repository {
  return {
    id: raw.id,
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

function toCommit(raw: any): Commit {
  return {
    sha: raw.sha,
    message: raw.commit?.message ?? "",
    author: raw.commit?.author?.name ?? raw.commit?.author?.email ?? "",
    date: raw.commit?.author?.date ?? "",
    url: raw.html_url,
  };
}

function hasNextPage(headers: Record<string, any>): boolean {
  const link = headers?.link as string | undefined;
  return !!link && /rel="?next"?/i.test(link);
}

function toPage<T>(items: T[], headers: Record<string, any>, page: number): Page<T> {
  const hasMore = hasNextPage(headers);
  return { items, hasMore, nextPage: hasMore ? page + 1 : null };
}

export class GithubAdapter implements GitProvider {
  private octokit: InstanceType<typeof MyOctokit>;

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

  async listBranches(owner: string, repo: string): Promise<string[]> {
    return paginate(
      async (page) => {
        const { data, headers } = await this.octokit.request(
          "GET /repos/{owner}/{repo}/branches",
          {
            owner,
            repo,
            per_page: 100,
            page,
          },
        );
        return toPage(data.map((branch: any) => branch.name), headers, page);
      },
      { pageSize: 100, dedupeKey: (name) => name },
    );
  }

  async listCommitsPage(owner: string, repo: string, params?: CommitParams): Promise<Page<Commit>> {
    const { data, headers } = await this.octokit.request(
      "GET /repos/{owner}/{repo}/commits",
      {
        owner,
        repo,
        per_page: params?.perPage || 100,
        page: params?.page ?? 1,
        sort: "created",
        direction: "desc",
        sha: params?.branch,
        since: params?.since,
        until: params?.until,
      },
    );
    return toPage(data.map(toCommit), headers, params?.page ?? 1);
  }

  async listCommits(owner: string, repo: string, params?: CommitParams): Promise<Commit[]> {
    return paginate(
      (page) => this.listCommitsPage(owner, repo, { ...params, page }),
      {
        pageSize: params?.perPage || 100,
        maxCommits: params?.maxCommits,
        maxPages: params?.maxPages,
        dedupeKey: (c) => c.sha,
      },
    );
  }

  async countCommits(owner: string, repo: string, params?: DateRangeParams): Promise<number> {
    try {
      const dateQuery =
        params?.since && params?.until
          ? `committer-date:${params.since}..${params.until}`
          : params?.since
            ? `committer-date:>=${params.since}`
            : "";
      const query = dateQuery
        ? `repo:${owner}/${repo} ${dateQuery}`
        : `repo:${owner}/${repo}`;
      const { data } = await this.octokit.request("GET /search/commits", {
        q: query,
        per_page: 1,
      });
      return data.total_count;
    } catch {
      // Fallback: walk pages. Bounded so a rare search failure can't turn into
      // a full-history enumeration; the search API is the primary path.
      try {
        const commits = await this.listCommits(owner, repo, {
          perPage: 100,
          since: params?.since,
          until: params?.until,
          maxCommits: 1000,
          maxPages: 10,
        });
        return commits.length;
      } catch {
        return 0;
      }
    }
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
