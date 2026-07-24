import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("../shared/github", () => ({
  octokit: { request: vi.fn() },
}));

vi.mock("../config/env", () => ({
  env: {
    PORT: 0,
    HOST: "localhost",
    DATABASE_URL: "file:./test.db",
    GITHUB_TOKEN: "mock-token",
    CORS_ORIGIN: "*",
  },
}));

import { buildApp } from "../app";
import { octokit } from "../shared/github";

describe("GET /api/v1/verification/status", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns ok when GitHub token is valid", async () => {
    vi.mocked(octokit.request).mockResolvedValue({
      data: { login: "testuser" },
    } as any);

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/verification/status",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "ok",
      github: { login: "testuser", rateLimitRemaining: 5000 },
    });
  });

  it("returns 500 when GitHub API fails (schema mismatch on error body)", async () => {
    vi.mocked(octokit.request).mockRejectedValue(new Error("Unauthorized"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/verification/status",
    });
    expect(res.statusCode).toBe(500);
  });
});
