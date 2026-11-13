import { describe, it, expect } from "vitest";
import { buildApp } from "@/build-app";

describe("GET /api/v1/health", () => {
  it("returns status ok", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });
});

describe("request id correlation", () => {
  it("mints and echoes x-request-id", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.headers["x-request-id"]).toBeTruthy();
    await app.close();
  });

  it("reuses an inbound x-request-id", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/health",
      headers: { "x-request-id": "abc-123" },
    });
    expect(res.headers["x-request-id"]).toBe("abc-123");
    await app.close();
  });
});
