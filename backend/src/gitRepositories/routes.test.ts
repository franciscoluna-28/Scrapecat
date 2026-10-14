import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const mockProvider = {
  listRepositories: vi.fn(),
  searchPublicRepositories: vi.fn(),
  listBranches: vi.fn(),
  getDefaultBranch: vi.fn(async () => "main"),
};

vi.mock("@/shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

const mockGetProjectByOwnerRepo = vi.fn();
const mockListCommitsForProject = vi.fn();

vi.mock("@/projects/stores/projects-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/projects/stores/projects-store")>();
  return {
    ...actual,
    getProjectByOwnerRepo: (...args: unknown[]) => mockGetProjectByOwnerRepo(...args),
  };
});

vi.mock("@/projects/stores/commit-chunks-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/projects/stores/commit-chunks-store")>();
  return {
    ...actual,
    listCommitsForProject: (...args: unknown[]) => mockListCommitsForProject(...args),
  };
});

vi.mock("@/github/token", () => ({
  resolveGithubToken: vi.fn(async () => null),
}));

import { buildApp } from "@/build-app";

describe("GET /api/v1/repositories", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns repositories list", async () => {
    const repos: any = [{ name: "repo1", owner: "user1", fullName: "user1/repo1" }];
    mockProvider.searchPublicRepositories.mockResolvedValue(repos);

    const res = await app.inject({ method: "GET", url: "/api/v1/repositories" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(repos);
  });

  it("passes query parameters", async () => {
    mockProvider.searchPublicRepositories.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories?type=public&sort=full_name&direction=asc&per_page=5",
    });

    expect(mockProvider.searchPublicRepositories).toHaveBeenCalledWith("stars:>100", 5);
  });

  it("returns 500 on error", async () => {
    mockProvider.searchPublicRepositories.mockRejectedValue(new Error("API error"));

    const res = await app.inject({ method: "GET", url: "/api/v1/repositories" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch repositories" });
  });
});

describe("GET /api/v1/repositories/:owner/:repo/branches", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns branches list", async () => {
    mockProvider.listBranches.mockResolvedValue(["main", "dev"]);
    mockProvider.getDefaultBranch.mockResolvedValue("main");

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/branches",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ branches: ["main", "dev"], defaultBranch: "main" });
  });

  it("calls listBranches with correct params", async () => {
    mockProvider.listBranches.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/myuser/myrepo/branches",
    });

    expect(mockProvider.listBranches).toHaveBeenCalledWith("myuser", "myrepo");
  });

  it("returns 500 on error", async () => {
    mockProvider.listBranches.mockRejectedValue(new Error("API error"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/branches",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch branches" });
  });
});

describe("GET /api/v1/repositories/:owner/:repo/commits", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    mockGetProjectByOwnerRepo.mockResolvedValue({ id: "p1", defaultBranch: "main" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns commits from Postgres (the read model)", async () => {
    mockListCommitsForProject.mockResolvedValue([
      {
        commitSha: "abc",
        commitMessage: "fix",
        author: "dev",
        committedAt: new Date("2024-01-15T00:00:00.000Z"),
        metadata: { commitUrl: "https://github.com/owner1/repo1/commit/abc" },
      },
    ]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      commits: [
        {
          sha: "abc",
          message: "fix",
          author: "dev",
          date: "2024-01-15T00:00:00.000Z",
          url: "https://github.com/owner1/repo1/commit/abc",
        },
      ],
    });
    expect(mockGetProjectByOwnerRepo).toHaveBeenCalledWith({
      gitProvider: "github",
      providerOwner: "owner1",
      repositoryName: "repo1",
    });
  });

  it("passes branch and date range to the store", async () => {
    mockListCommitsForProject.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits?limit=50&branch=main&startDate=2024-01-01&endDate=2024-01-31",
    });

    expect(mockListCommitsForProject).toHaveBeenCalledWith({
      projectId: "p1",
      branch: "main",
      startDate: new Date("2024-01-01T00:00:00.000Z"),
      endDate: new Date("2024-01-31T00:00:00.000Z"),
    });
  });

  it("returns an empty list when the repo has no project yet", async () => {
    mockGetProjectByOwnerRepo.mockResolvedValueOnce(null);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ commits: [] });
  });

  it("returns 500 on error", async () => {
    mockGetProjectByOwnerRepo.mockRejectedValueOnce(new Error("db down"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch commits" });
  });

  it("rejects an invalid limit", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits?limit=not-a-number",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /api/v1/repositories/:owner/:repo/commits/count", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    mockGetProjectByOwnerRepo.mockResolvedValue({ id: "p1", defaultBranch: "main" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the stored commit count", async () => {
    mockListCommitsForProject.mockResolvedValue([{ commitSha: "a" }, { commitSha: "b" }]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 2 });
  });

  it("passes date range and branch query parameters", async () => {
    mockListCommitsForProject.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count?startDate=2024-01-01&endDate=2024-01-31&branch=main",
    });

    expect(mockListCommitsForProject).toHaveBeenCalledWith({
      projectId: "p1",
      branch: "main",
      startDate: new Date("2024-01-01T00:00:00.000Z"),
      endDate: new Date("2024-01-31T00:00:00.000Z"),
    });
  });

  it("returns 500 on error", async () => {
    mockGetProjectByOwnerRepo.mockRejectedValueOnce(new Error("db down"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch commit count" });
  });
});
