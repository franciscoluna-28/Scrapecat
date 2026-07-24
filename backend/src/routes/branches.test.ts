import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("../shared/github", () => ({
  getRepositoryBranches: vi.fn(),
}));

import { buildApp } from "../app";
import { getRepositoryBranches } from "../shared/github";

describe("GET /api/v1/repositories/:owner/:repo/branches", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns branches list", async () => {
    vi.mocked(getRepositoryBranches).mockResolvedValue(["main", "dev"]);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/branches",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ branches: ["main", "dev"] });
  });

  it("calls getRepositoryBranches with correct params", async () => {
    vi.mocked(getRepositoryBranches).mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories/myuser/myrepo/branches",
    });

    expect(getRepositoryBranches).toHaveBeenCalledWith("myuser", "myrepo");
  });

  it("returns 500 on error", async () => {
    vi.mocked(getRepositoryBranches).mockRejectedValue(new Error("API error"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner1/repo1/branches",
    });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch branches" });
  });
});
