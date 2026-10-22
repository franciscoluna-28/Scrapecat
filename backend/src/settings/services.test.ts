import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSettings = vi.fn();
const mockUpsertSettings = vi.fn();

vi.mock("@/settings/stores/settings-store", () => ({
  getSettings: (...args: unknown[]) => mockGetSettings(...args),
  upsertSettings: (...args: unknown[]) => mockUpsertSettings(...args),
}));

import { env } from "@/config/env";
import {
  GLOBAL_SETTINGS_ID,
  defaultAISettings,
  getAISettings,
  updateAISettings,
} from "@/settings/services";
import { makeAISettings, makeAISettingsInput } from "@/test/factories";

describe("AI settings service", () => {
  beforeEach(() => {
    mockGetSettings.mockReset().mockResolvedValue(null);
    mockUpsertSettings.mockReset().mockResolvedValue(undefined);
  });

  it("falls back to the environment defaults when no row exists", async () => {
    await expect(getAISettings()).resolves.toEqual({
      chatProvider: "openrouter",
      chatModel: env.AI_MODEL,
      embeddingProvider: "openrouter",
      embeddingModel: env.EMBEDDING_MODEL,
    });

    expect(defaultAISettings()).toEqual({
      chatProvider: "openrouter",
      chatModel: env.AI_MODEL,
      embeddingProvider: "openrouter",
      embeddingModel: env.EMBEDDING_MODEL,
    });
  });

  it("maps the stored row to the public settings shape", async () => {
    mockGetSettings.mockResolvedValue({
      ...makeAISettings({
        chatProvider: "opencode-go",
        chatModel: "deepseek-v4.1-flash",
      }),
      id: GLOBAL_SETTINGS_ID,
      updatedAt: new Date(),
    });

    await expect(getAISettings()).resolves.toEqual({
      chatProvider: "opencode-go",
      chatModel: "deepseek-v4.1-flash",
      embeddingProvider: "openrouter",
      embeddingModel: "openai/text-embedding-3-small",
    });
  });

  it("writes a valid update under the global settings id", async () => {
    const input = makeAISettingsInput({
      chatProvider: "openai",
      chatModel: "gpt-4o",
      embeddingModel: "openai/text-embedding-3-large",
    });
    mockGetSettings.mockResolvedValue({
      ...input,
      id: GLOBAL_SETTINGS_ID,
      updatedAt: new Date(),
    });

    await expect(updateAISettings(input)).resolves.toEqual(input);
    expect(mockUpsertSettings).toHaveBeenCalledWith({
      id: GLOBAL_SETTINGS_ID,
      ...input,
    });
  });

  it("rejects an unknown chat provider before writing", async () => {
    await expect(
      updateAISettings(makeAISettingsInput({ chatProvider: "not-a-provider" })),
    ).rejects.toThrow("Unsupported provider");

    expect(mockUpsertSettings).not.toHaveBeenCalled();
  });

  it("rejects an unknown embedding provider before writing", async () => {
    await expect(
      updateAISettings(makeAISettingsInput({ embeddingProvider: "not-a-provider" })),
    ).rejects.toThrow("Unsupported embedding provider");

    expect(mockUpsertSettings).not.toHaveBeenCalled();
  });

  it("rejects a chat-only provider as an embedding provider", async () => {
    await expect(
      updateAISettings(makeAISettingsInput({ embeddingProvider: "opencode-go" })),
    ).rejects.toThrow("Unsupported embedding provider");
  });
});
