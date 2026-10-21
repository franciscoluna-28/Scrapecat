import { afterEach, describe, expect, it, vi } from "vitest";
import { GitlabAdapter } from "@/shared/integrations/git-provider/gitlab-adapter";
import { GitlabApiError } from "@/shared/integrations/git-provider/gitlab-client";

const HOST = "https://gitlab.example.com";

function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function project(id: number, starCount: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Repo ${id}`,
    path: `repo-${id}`,
    path_with_namespace: `group/repo-${id}`,
    description: null,
    default_branch: "main",
    visibility: "public",
    last_activity_at: "2026-01-02T03:04:05Z",
    star_count: starCount,
    forks_count: 1,
    namespace: { path: "group", full_path: "group" },
    ...overrides,
  };
}

function stubFetch() {
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GitlabAdapter", () => {
  it("maps projects into the provider-neutral repository shape", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        project(42, 7, {
          name: "My Repo",
          path: "my-repo",
          path_with_namespace: "group/subgroup/my-repo",
          description: "Nested group project",
          visibility: "internal",
          namespace: { path: "subgroup", full_path: "group/subgroup" },
        }),
      ]),
    );

    const adapter = new GitlabAdapter("glpat-token", HOST);
    const repositories = await adapter.listRepositories({
      type: "all",
      sort: "updated",
      direction: "desc",
      perPage: 5,
    });

    expect(repositories).toEqual([
      {
        id: "42",
        name: "my-repo",
        full_name: "group/subgroup/my-repo",
        owner: { login: "group/subgroup" },
        private: true,
        description: "Nested group project",
        default_branch: "main",
        updated_at: "2026-01-02T03:04:05Z",
        stargazers_count: 7,
        forks_count: 1,
      },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    const requestUrl = String(url);
    expect(requestUrl).toContain(`${HOST}/api/v4/projects?`);
    expect(requestUrl).toContain("membership=true");
    expect(requestUrl).toContain("order_by=last_activity_at");
    expect(requestUrl).toContain("sort=desc");
    expect(requestUrl).toContain("per_page=5");
    expect(init.headers["PRIVATE-TOKEN"]).toBe("glpat-token");
  });

  it("walks branch pages using x-next-page", async () => {
    const fetchMock = stubFetch();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse([{ name: "main" }, { name: "dev" }], {
          headers: { "x-next-page": "2" },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse([{ name: "feature" }], { headers: { "x-next-page": "" } }),
      );

    const adapter = new GitlabAdapter("glpat-token", HOST);
    const branches = await adapter.listBranches("group/subgroup", "repo");

    expect(branches).toEqual(["main", "dev", "feature"]);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/projects/group%2Fsubgroup%2Frepo/repository/branches",
    );
  });

  it("maps the current user and rate limit", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { username: "gl-user" },
        { headers: { "ratelimit-remaining": "1999" } },
      ),
    );

    const adapter = new GitlabAdapter("glpat-token", HOST);

    await expect(adapter.verifyConnection()).resolves.toEqual({
      login: "gl-user",
      rateLimitRemaining: 1999,
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe(`${HOST}/api/v4/user`);
  });

  it("throws a typed error for API failures", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "401 Unauthorized" }, { status: 401 }),
    );

    const adapter = new GitlabAdapter("bad-token", HOST);
    const error = await adapter.verifyConnection().catch((err) => err);

    expect(error).toBeInstanceOf(GitlabApiError);
    expect(error.status).toBe(401);
    expect(error.message).toBe("401 Unauthorized");
  });

  it("drops GitHub star qualifiers and filters by star count", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse([project(1, 500), project(2, 50)]),
    );

    const adapter = new GitlabAdapter(null, HOST);
    const repositories = await adapter.searchPublicRepositories("stars:>100", 10);

    expect(repositories.map((repo) => repo.id)).toEqual(["1"]);
    const requestUrl = String(fetchMock.mock.calls[0][0]);
    expect(requestUrl).toContain("visibility=public");
    expect(requestUrl).toContain("order_by=star_count");
    expect(requestUrl).not.toContain("stars");
  });

  it("normalizes hosts without a scheme", async () => {
    const fetchMock = stubFetch();
    fetchMock.mockResolvedValueOnce(jsonResponse([]));

    const adapter = new GitlabAdapter(null, "gitlab.example.com/");
    await adapter.searchPublicRepositories("", 10);

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "https://gitlab.example.com/api/v4/projects",
    );
  });
});
