import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("../shared/github", () => ({
  getRepositoryCommits: vi.fn(),
  getRepositoryCommitCount: vi.fn(),
}));

import { buildApp } from "../app";
import { getRepositoryCommits, getRepositoryCommitCount } from "../shared/github";

describe("GET /api/v1/repositories/:owner/:repo/commits", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns commits list", async () => {
    const commits: any = [{ sha: "abc", commit: { message: "fix" } }];
    vi.mocked(getRepositoryCommits).mockResolvedValue(commits);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ commits });
  });

  it("passes query parameters", async () => {
    vi.mocked(getRepositoryCommits).mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits?limit=50&branch=main&startDate=2024-01-01&endDate=2024-01-31",
    });

    expect(getRepositoryCommits).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "owner1",
        repo: "repo1",
        per_page: 50,
        sha: "main",
        since: "2024-01-01",
        until: "2024-01-31",
      }),
    );
  });

  it("returns 500 on error", async () => {
    vi.mocked(getRepositoryCommits).mockRejectedValue(new Error("API error"));

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
    vi.mocked(getRepositoryCommitCount).mockResolvedValue(42);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 42 });
  });

  it("passes date range query parameters", async () => {
    vi.mocked(getRepositoryCommitCount).mockResolvedValue(0);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count?startDate=2024-01-01&endDate=2024-01-31",
    });

    expect(getRepositoryCommitCount).toHaveBeenCalledWith(
      expect.objectContaining({ since: "2024-01-01", until: "2024-01-31" }),
    );
  });

  it("returns 500 on error", async () => {
    vi.mocked(getRepositoryCommitCount).mockRejectedValue(new Error("API error"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/commits/count",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch commit count" });
  });
});
