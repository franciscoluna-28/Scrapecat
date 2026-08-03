import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";
import type { GitProvider } from "./provider";
import type {
  Repository,
  Commit,
  CommitDetail,
  PullRequest,
  RepositoryFilters,
  CommitParams,
  DateRangeParams,
  ConnectionStatus,
} from "./types";

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

function toPullRequest(raw: any): PullRequest {
  return {
    body: raw.body ?? null,
    number: raw.number,
    title: raw.title ?? "",
    url: raw.html_url,
  };
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
    const { data } = await this.octokit.request("GET /repos/{owner}/{repo}/branches", {
      owner,
      repo,
      per_page: 100,
    });
    return data.map((branch: any) => branch.name);
  }

  async listCommits(owner: string, repo: string, params?: CommitParams): Promise<Commit[]> {
    const { data } = await this.octokit.request("GET /repos/{owner}/{repo}/commits", {
      owner,
      repo,
      per_page: params?.perPage || 100,
      sort: "created",
      direction: "desc",
      sha: params?.branch,
      since: params?.since,
      until: params?.until,
    });
    return data.map(toCommit);
  }

  async getCommitDetails(owner: string, repo: string, sha: string): Promise<CommitDetail | null> {
    try {
      const { data } = await this.octokit.request("GET /repos/{owner}/{repo}/commits/{ref}", {
        owner,
        repo,
        ref: sha,
      });
      const stats = data.stats ?? {};
      return {
        sha,
        message: data.commit?.message ?? "",
        author: data.commit?.author?.name ?? data.commit?.author?.email ?? "",
        date: data.commit?.author?.date ?? "",
        url: data.html_url,
        stats: {
          additions: stats.additions ?? 0,
          deletions: stats.deletions ?? 0,
          total: stats.total ?? 0,
        },
        files: (data.files ?? []).map((f: any) => ({
          filename: f.filename ?? "",
          additions: f.additions ?? 0,
          deletions: f.deletions ?? 0,
          patch: f.patch ?? null,
        })),
      };
    } catch {
      return null;
    }
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
      try {
        const commits = await this.listCommits(owner, repo, {
          perPage: 100,
          since: params?.since,
          until: params?.until,
        });
        return commits.length;
      } catch {
        return 0;
      }
    }
  }

  async getPullRequestForCommit(
    owner: string,
    repo: string,
    commitSha: string,
  ): Promise<PullRequest | null> {
    try {
      const { data: prs } = await this.octokit.request(
        "GET /repos/{owner}/{repo}/commits/{commit_sha}/pulls",
        { owner, repo, commit_sha: commitSha, per_page: 1 },
      );
      const pr = prs?.[0];
      if (!pr) return null;
      return toPullRequest(pr);
    } catch {
      return null;
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
