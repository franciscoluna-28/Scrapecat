import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DEMO_MODE = "true";
});

vi.mock("@/api/settings/services", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/settings/services")>();
  return {
    ...actual,
    getAISettings: vi.fn(async () => ({
      chatProvider: "openrouter",
      chatModel: "google/gemma-4-31b-it",
      embeddingProvider: "openrouter",
      embeddingModel: "openai/text-embedding-3-small",
    })),
    updateAISettings: vi.fn(),
  };
});

import { buildApp } from "@/build-app";

describe("AI settings routes in demo mode", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("still reads settings", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v1/settings/ai" });
    expect(res.statusCode).toBe(200);
  });

  it("refuses to mutate global settings", async () => {
    const res = await app.inject({
      method: "PUT",
      url: "/api/v1/settings/ai",
      payload: {
        chatProvider: "openrouter",
        chatModel: "google/gemma-4-31b-it",
        embeddingProvider: "openrouter",
        embeddingModel: "openai/text-embedding-3-small",
      },
    });
    expect(res.statusCode).toBe(403);
  });
});
