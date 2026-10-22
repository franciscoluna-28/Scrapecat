import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "@/build-app";

const ROUTES = [
  ["GET", "/api/v1/health"],
  ["GET", "/api/v1/meta"],
  ["POST", "/api/v1/git-providers/:provider/connection"],
  ["GET", "/api/v1/git-providers/:provider/connection"],
  ["DELETE", "/api/v1/git-providers/:provider/connection"],
  ["GET", "/api/v1/models"],
  ["GET", "/api/v1/repositories"],
  ["GET", "/api/v1/repositories/:owner/:repo/branches"],
  ["GET", "/api/v1/repositories/:owner/:repo/commits"],
  ["GET", "/api/v1/repositories/:owner/:repo/commits/count"],
  ["GET", "/api/v1/projects"],
  ["POST", "/api/v1/projects"],
  ["POST", "/api/v1/projects/:id/branches/prepare"],
  ["GET", "/api/v1/credentials"],
  ["POST", "/api/v1/credentials"],
  ["DELETE", "/api/v1/credentials/:id"],
  ["POST", "/api/v1/credentials/verify"],
  ["GET", "/api/v1/settings/ai"],
  ["PUT", "/api/v1/settings/ai"],
  ["POST", "/api/v1/chat/sessions"],
  ["GET", "/api/v1/chat/sessions"],
  ["GET", "/api/v1/chat/sessions/:id/messages"],
  ["DELETE", "/api/v1/chat/sessions/:id"],
  ["POST", "/api/v1/chat/sessions/:id/messages"],
] as const;

describe("buildApp", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(ROUTES)("registers %s %s", (method, url) => {
    expect(app.hasRoute({ method, url })).toBe(true);
  });

  it("returns JSON for unknown routes", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/does-not-exist" });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({
      statusCode: 404,
      error: "Not Found",
      message: "Route GET:/api/v1/does-not-exist not found",
    });
  });

  it.todo("maps unknown routes to the shared { error } contract");

  it("maps validation failures to the shared error contract", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories?per_page=0",
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "Invalid request parameters" });
  });
});
