import {
  createGitlabClient,
  type GitlabClient,
} from "@/shared/integrations/git-provider/gitlab-client";
import type { GitProvider } from "@/shared/integrations/git-provider/provider";
import type {
  Repository,
  RepositoryFilters,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";

/** Minimal shapes for the GitLab fields we consume (snake_case by default). */
type GitlabNamespace = {
  path?: string;
  full_path?: string;
};

type GitlabProject = {
  id: number;
  name: string;
  path: string;
  path_with_namespace: string;
  description: string | null;
  default_branch: string | null;
  visibility: string;
  last_activity_at?: string;
  updated_at?: string;
  star_count?: number;
  forks_count?: number;
  namespace?: GitlabNamespace;
};

const GITHUB_SORT_TO_GITLAB: Record<string, string> = {
  updated: "last_activity_at",
  pushed: "last_activity_at",
  created: "created_at",
  stars: "star_count",
};

/** GitLab accepts a URL-encoded `group/subgroup/project` path as project id. */
function projectRef(owner: string, repo: string): string {
  return encodeURIComponent(`${owner}/${repo}`);
}

function toRepository(raw: GitlabProject): Repository {
  return {
    id: String(raw.id),
    // `path` is the URL slug (`repo`); `name` is the display name.
    name: raw.path,
    full_name: raw.path_with_namespace,
    owner: {
      login: raw.namespace?.full_path ?? raw.namespace?.path ?? "",
    },
    // `private` means "not publicly readable" — internal projects included.
    private: raw.visibility !== "public",
    description: raw.description ?? null,
    default_branch: raw.default_branch ?? "main",
    updated_at: raw.last_activity_at ?? raw.updated_at ?? new Date(0).toISOString(),
    stargazers_count: raw.star_count,
    forks_count: raw.forks_count,
  };
}

/**
 * Parses the GitHub-shaped public-search query used by the demo/discovery path
 * (`"stars:>100"`) into a plain GitLab search term plus a star threshold.
 * GitLab has no `stars:>` qualifier, so the threshold is applied client-side.
 */
function parseSearchQuery(query: string): { term: string; minStars: number | null } {
  const starMatch = query.match(/stars:>(\d+)/i);
  const minStars = starMatch ? Number(starMatch[1]) : null;
  const term = query
    .replace(/stars:>\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return { term, minStars };
}

export class GitlabAdapter implements GitProvider {
  private client: GitlabClient;

  constructor(token: string | null, host?: string) {
    this.client = createGitlabClient(token, host);
  }

  async listRepositories(filters?: RepositoryFilters): Promise<Repository[]> {
    const query: Record<string, string | number | boolean> = {
      membership: true,
      per_page: filters?.perPage ?? 10,
      order_by: GITHUB_SORT_TO_GITLAB[filters?.sort ?? "updated"] ?? "last_activity_at",
      sort: filters?.direction === "asc" ? "asc" : "desc",
    };

    // GitHub's `type=public|private` maps to GitLab's visibility filter.
    if (filters?.type === "public" || filters?.type === "private") {
      query.visibility = filters.type;
    }

    const { data } = await this.client.request<GitlabProject[]>("/projects", {
      query,
    });
    return data.map(toRepository);
  }

  /**
   * Token-less public search (demo fallback). GitLab searches project names and
   * paths; results are ordered by stars so the top public repos surface first.
   */
  async searchPublicRepositories(query: string, perPage = 10): Promise<Repository[]> {
    const { term, minStars } = parseSearchQuery(query);

    const { data } = await this.client.request<GitlabProject[]>("/projects", {
      query: {
        // GitLab rejects search terms shorter than 3 characters.
        search: term.length >= 3 ? term : undefined,
        visibility: "public",
        order_by: "star_count",
        sort: "desc",
        per_page: perPage,
      },
    });

    const repositories = data.map(toRepository);
    return minStars === null
      ? repositories
      : repositories.filter((repo) => (repo.stargazers_count ?? 0) >= minStars);
  }

  async listBranches(owner: string, repo: string): Promise<string[]> {
    const branches = await this.client.requestAll<{ name: string }>(
      `/projects/${projectRef(owner, repo)}/repository/branches`,
    );
    return branches.map((branch) => branch.name);
  }

  async getDefaultBranch(owner: string, repo: string): Promise<string> {
    const { data } = await this.client.request<GitlabProject>(
      `/projects/${projectRef(owner, repo)}`,
    );
    return data.default_branch ?? "main";
  }

  async getRepositoryId(owner: string, repo: string): Promise<string> {
    const { data } = await this.client.request<GitlabProject>(
      `/projects/${projectRef(owner, repo)}`,
    );
    return String(data.id);
  }

  async verifyConnection(): Promise<ConnectionStatus> {
    const { data, headers } = await this.client.request<{ username: string }>(
      "/user",
    );

    const rawRateLimit = headers.get("ratelimit-remaining");
    const rateLimitRemaining =
      rawRateLimit === null ? undefined : Number(rawRateLimit);

    return {
      login: data.username,
      ...(Number.isFinite(rateLimitRemaining) ? { rateLimitRemaining } : {}),
    };
  }
}
