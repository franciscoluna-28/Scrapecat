import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("../shared/github", () => ({
  getAllRepositories: vi.fn(),
}));

import { buildApp } from "../app";
import { getAllRepositories } from "../shared/github";

describe("GET /api/v1/repositories", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns repositories list", async () => {
    const repos: any = [{ name: "repo1", owner: { login: "user1" } }];
    vi.mocked(getAllRepositories).mockResolvedValue(repos);

    const res = await app.inject({ method: "GET", url: "/api/v1/repositories" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(repos);
  });

  it("passes query parameters", async () => {
    vi.mocked(getAllRepositories).mockResolvedValue([]);

    await app.inject({
      method: "GET",
      url: "/api/v1/repositories?type=public&sort=full_name&direction=asc&per_page=5",
    });

    expect(vi.mocked(getAllRepositories)).toHaveBeenCalledWith(
      expect.objectContaining({ type: "public", sort: "full_name", direction: "asc", per_page: 5 }),
    );
  });

  it("returns 500 on error", async () => {
    vi.mocked(getAllRepositories).mockRejectedValue(new Error("API error"));

    const res = await app.inject({ method: "GET", url: "/api/v1/repositories" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch repositories" });
  });
});
