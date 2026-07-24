import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../app";

describe("GET /api/v1/models", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns sorted models from OpenRouter", async () => {
    const mockModels = {
      data: [
        { id: "model-b", name: "Model B", pricing: { prompt: "0", completion: "0" }, description: "Free model" },
        { id: "model-a", name: "Model A", pricing: { prompt: "0.01", completion: "0.02" }, description: "Paid model" },
      ],
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModels),
    }));

    const res = await app.inject({ method: "GET", url: "/api/v1/models" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty("models");
    expect(res.json().models).toHaveLength(2);
  });

  it("returns 500 when OpenRouter API fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    }));

    const res = await app.inject({ method: "GET", url: "/api/v1/models" });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: "Failed to fetch models" });
  });

  it("sets Cache-Control header", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    }));

    const res = await app.inject({ method: "GET", url: "/api/v1/models" });
    expect(res.headers["cache-control"]).toBe("public, max-age=3600, s-maxage=3600");
  });
});
