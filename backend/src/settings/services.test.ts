import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSettings = vi.fn();
const mockUpsertSettings = vi.fn();
const mockEnqueue = vi.fn();
const mockRunAndWait = vi.fn();

vi.mock("@/settings/stores/settings-store", () => ({
  settingsStore: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    upsertSettings: (...args: unknown[]) => mockUpsertSettings(...args),
  },
}));

vi.mock("@/shared/queue", () => ({
  getJobQueue: vi.fn(async () => ({
    enqueue: mockEnqueue,
    runAndWait: mockRunAndWait,
  })),
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
    mockEnqueue.mockReset().mockResolvedValue(undefined);
    mockRunAndWait.mockReset().mockResolvedValue({
      provider: "openrouter",
      model: "openai/text-embedding-3-small",
      projects: 0,
      embedded: 0,
    });
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

  it("writes a valid update and reindexes when the embedding model changes", async () => {
    const input = makeAISettingsInput({
      chatProvider: "openai",
      chatModel: "gpt-4o",
      embeddingModel: "openai/text-embedding-3-large",
    });
    const previous = makeAISettings();
    const updatedRow = {
      ...input,
      id: GLOBAL_SETTINGS_ID,
      updatedAt: new Date(),
    };
    mockGetSettings
      .mockResolvedValueOnce({
        ...previous,
        id: GLOBAL_SETTINGS_ID,
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce(updatedRow)
      .mockResolvedValue(updatedRow);
    mockRunAndWait.mockResolvedValue({
      provider: input.embeddingProvider,
      model: input.embeddingModel,
      projects: 0,
      embedded: 0,
    });

    await expect(updateAISettings(input)).resolves.toEqual(input);
    expect(mockUpsertSettings).toHaveBeenCalledWith({
      id: GLOBAL_SETTINGS_ID,
      ...input,
    });
    expect(mockEnqueue).toHaveBeenCalledWith(
      "reindex-embeddings",
      "reindex-embeddings",
      {},
    );
    expect(mockRunAndWait).toHaveBeenCalledWith("reindex-embeddings");
  });

  it("does not reindex when only chat settings change", async () => {
    const input = makeAISettingsInput({
      chatProvider: "openai",
      chatModel: "gpt-4o",
    });
    const previous = makeAISettings();
    mockGetSettings
      .mockResolvedValueOnce({
        ...previous,
        id: GLOBAL_SETTINGS_ID,
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        ...input,
        id: GLOBAL_SETTINGS_ID,
        updatedAt: new Date(),
      });

    await expect(updateAISettings(input)).resolves.toEqual(input);
    expect(mockEnqueue).not.toHaveBeenCalled();
    expect(mockRunAndWait).not.toHaveBeenCalled();
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
