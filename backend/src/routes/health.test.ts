import { describe, it, expect } from "vitest";
import { buildApp } from "../app";

describe("GET /api/v1/health", () => {
  it("returns status ok", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
