import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const mockProvider = { listBranches: vi.fn() };

vi.mock("../services/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

import { buildApp } from "../app";

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
