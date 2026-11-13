import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSettings = vi.fn();
const mockUpsertSettings = vi.fn();
const mockEnqueue = vi.fn();
const mockRunAndWait = vi.fn();

vi.mock("@/api/settings/stores/settings-store", () => ({
  settingsStore: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    upsertSettings: (...args: unknown[]) => mockUpsertSettings(...args),
  },
}));

vi.mock("@/shared/queue", () => ({
  getJobQueue: vi.fn(() => ({
    enqueue: mockEnqueue,
    runAndWait: mockRunAndWait,
  })),
}));

import { env } from "@/shared/config/env";
import { JOB_NAMES, REINDEX_EMBEDDINGS_JOB_ID } from "@/shared/queue/jobs";
import {
  GLOBAL_SETTINGS_ID,
  defaultAISettings,
  getAISettings,
  updateAISettings,
} from "@/api/settings/services";
import { makeAISettings, makeAISettingsInput } from "@/shared/test/factories";

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

  it("falls back to local Ollama defaults when no row exists outside demo mode", async () => {
    expect(env.isDemoMode).toBe(false);

    const localDefaults = {
      chatProvider: "ollama",
      chatModel: "llama3.2:1b",
      embeddingProvider: "ollama",
      embeddingModel: "nomic-embed-text",
    };

    await expect(getAISettings()).resolves.toEqual(localDefaults);
    expect(defaultAISettings()).toEqual(localDefaults);
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
      JOB_NAMES.reindexEmbeddings,
      REINDEX_EMBEDDINGS_JOB_ID,
      {},
    );
    expect(mockRunAndWait).toHaveBeenCalledWith(REINDEX_EMBEDDINGS_JOB_ID);
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

  it("rejects a model outside a closed catalog", async () => {
    await expect(
      updateAISettings(
        makeAISettingsInput({ chatProvider: "openai", chatModel: "not-a-model" }),
      ),
    ).rejects.toThrow("Unsupported model");

    expect(mockUpsertSettings).not.toHaveBeenCalled();
  });

  it("rejects an unknown embedding model", async () => {
    await expect(
      updateAISettings(
        makeAISettingsInput({ embeddingModel: "not-an-embedding-model" }),
      ),
    ).rejects.toThrow("Unsupported embedding model");

    expect(mockUpsertSettings).not.toHaveBeenCalled();
  });

  it("allows dynamic models for OpenRouter and Ollama", async () => {
    const previous = makeAISettings();
    const input = makeAISettingsInput({
      chatProvider: "openrouter",
      chatModel: "vendor/dynamic-free-model",
    });
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
  });
});
