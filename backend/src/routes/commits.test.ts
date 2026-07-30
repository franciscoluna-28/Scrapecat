import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const mockProvider = { listCommits: vi.fn(), countCommits: vi.fn() };

vi.mock("../services/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

import { buildApp } from "../app";

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
    mockProvider.listCommits.mockResolvedValue(commits);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ commits });
  });

  it("passes query parameters", async () => {
    mockProvider.listCommits.mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits?limit=50&branch=main&startDate=2024-01-01&endDate=2024-01-31",
    });

    expect(mockProvider.listCommits).toHaveBeenCalledWith("owner1", "repo1", {
      perPage: 50,
      branch: "main",
      since: "2024-01-01",
      until: "2024-01-31",
    });
  });

  it("returns 500 on error", async () => {
    mockProvider.listCommits.mockRejectedValue(new Error("API error"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch commits" });
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
