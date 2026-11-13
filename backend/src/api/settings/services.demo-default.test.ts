import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DEMO_MODE = "true";
});

vi.mock("@/api/settings/stores/settings-store", () => ({
  settingsStore: {
    getSettings: vi.fn(async () => null),
    upsertSettings: vi.fn(),
  },
}));

vi.mock("@/shared/queue", () => ({
  getJobQueue: vi.fn(() => ({ enqueue: vi.fn(), runAndWait: vi.fn() })),
}));

import { env } from "@/shared/config/env";
import { defaultAISettings } from "@/api/settings/services";

describe("AI settings demo defaults", () => {
  it("keeps the cloud defaults in demo mode", () => {
    expect(env.isDemoMode).toBe(true);
    expect(defaultAISettings()).toEqual({
      chatProvider: "openrouter",
      chatModel: env.AI_MODEL,
      embeddingProvider: "openrouter",
      embeddingModel: env.EMBEDDING_MODEL,
    });
  });
});
