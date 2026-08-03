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

  it("returns models from OpenRouter plus provider fallbacks", async () => {
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
    const body = res.json();
    expect(body).toHaveProperty("models");
    expect(body.models.length).toBeGreaterThan(0);
    expect(body.models.map((m: any) => m.provider)).toContain("openrouter");
  });

  it("filters by provider", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    const res = await app.inject({ method: "GET", url: "/api/v1/models?provider=deepseek" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.models.length).toBeGreaterThan(0);
    expect(body.models.every((m: any) => m.provider === "deepseek")).toBe(true);
  });

  it("returns 400 for unknown provider", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/models?provider=nope" });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toEqual({ error: "Unknown provider: nope" });
  });
});
