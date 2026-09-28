import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

const mockProvider = { verifyConnection: vi.fn() };

vi.mock("@/shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

vi.mock("@/github/token", () => ({
  resolveGithubToken: vi.fn(async () => null),
}));

vi.mock("@/config/env", () => ({
  env: {
    PORT: 0,
    HOST: "localhost",
    DATABASE_URL: "postgres://postgres:postgres@localhost:5432/scrapecat_test",
    GITHUB_TOKEN: "",
    GIT_PROVIDER: "github",
    CORS_ORIGIN: "*",
  },
}));

import { buildApp } from "@/app";

describe("GET /api/v1/verification/status — no token", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports the error in-band when GITHUB_TOKEN is empty", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/verification/status",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: "error",
      message: "GitHub token is not configured",
    });
  });
});
