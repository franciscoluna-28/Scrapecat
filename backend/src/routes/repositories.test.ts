import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const mockProvider = { listRepositories: vi.fn() };

vi.mock("../services/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

import { buildApp } from "../app";

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
