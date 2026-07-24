import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("../services/github", () => ({
  octokit: { request: vi.fn() },
}));

vi.mock("../config/env", () => ({
  env: {
    PORT: 0,
    HOST: "localhost",
    DATABASE_URL: "file:./test.db",
    GITHUB_TOKEN: "",
    CORS_ORIGIN: "*",
  },
}));

import { buildApp } from "../app";

describe("GET /api/v1/verification/status — no token", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns 500 when GITHUB_TOKEN is empty (schema mismatch on error body)", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/verification/status",
    });
    expect(res.statusCode).toBe(500);
  });
});
