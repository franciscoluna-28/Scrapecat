import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const mockProvider = {
  listRepositories: vi.fn(),
  listBranches: vi.fn(),
  listCommitsPage: vi.fn(),
  listCommits: vi.fn(),
  countCommits: vi.fn(),
};

vi.mock("@/shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

import { buildApp } from "@/app";

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
    mockProvider.listRepositories.mockResolvedValue(repos);

    const res = await app.inject({ method: "GET", url: "/api/v1/repositories" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(repos);
  });

  it("passes query parameters", async () => {
    mockProvider.listRepositories.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories?type=public&sort=full_name&direction=asc&per_page=5",
    });

    expect(mockProvider.listRepositories).toHaveBeenCalledWith({
      type: "public",
      sort: "full_name",
      direction: "asc",
      perPage: 5,
    });
  });

  it("returns 500 on error", async () => {
    mockProvider.listRepositories.mockRejectedValue(new Error("API error"));

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

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/branches",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ branches: ["main", "dev"] });
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
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns commits list", async () => {
    const commits: any = [{ sha: "abc", message: "fix", author: "dev", date: "2024-01-15" }];
    mockProvider.listCommitsPage.mockResolvedValue({ items: commits, hasMore: false, nextPage: null });

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ commits });
  });

  it("passes query parameters", async () => {
    mockProvider.listCommitsPage.mockResolvedValue({ items: [], hasMore: false, nextPage: null });

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits?limit=50&branch=main&startDate=2024-01-01&endDate=2024-01-31",
    });

    expect(mockProvider.listCommitsPage).toHaveBeenCalledWith("owner1", "repo1", {
      perPage: 50,
      page: 1,
      branch: "main",
      since: "2024-01-01",
      until: "2024-01-31",
    });
  });

  it("returns 500 on error", async () => {
    mockProvider.listCommitsPage.mockRejectedValue(new Error("API error"));

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
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns commit count", async () => {
    mockProvider.countCommits.mockResolvedValue(42);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 42 });
  });

  it("passes date range query parameters", async () => {
    mockProvider.countCommits.mockResolvedValue(0);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count?startDate=2024-01-01&endDate=2024-01-31",
    });

    expect(mockProvider.countCommits).toHaveBeenCalledWith("owner1", "repo1", {
      since: "2024-01-01",
      until: "2024-01-31",
    });
  });

  it("returns 500 on error", async () => {
    mockProvider.countCommits.mockRejectedValue(new Error("API error"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch commit count" });
  });
});
