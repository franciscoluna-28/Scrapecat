import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const mockProvider = { verifyConnection: vi.fn() };

vi.mock("@/shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

vi.mock("@/config/env", () => ({
  env: {
    PORT: 0,
    HOST: "localhost",
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/scrapecat_test",
    GITHUB_TOKEN: "mock-token",
    GIT_PROVIDER: "github",
    CORS_ORIGIN: "*",
  },
}));

vi.mock("@/github/token", () => ({
  resolveGithubToken: vi.fn(async () => "mock-token"),
}));

import { buildApp } from "@/build-app";

describe("GET /api/v1/verification/status", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns ok when GitHub token is valid", async () => {
    mockProvider.verifyConnection.mockResolvedValue({
      login: "testuser",
      rateLimitRemaining: 5000,
    });

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

  it("reports the error in-band when the GitHub API fails", async () => {
    mockProvider.verifyConnection.mockRejectedValue(new Error("Unauthorized"));

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/verification/status",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "error", message: "Unauthorized" });
  });
});
