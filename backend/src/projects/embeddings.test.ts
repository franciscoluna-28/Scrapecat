import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("openai", () => {
  const create = vi.fn();
  const MockOpenAI = class {
    embeddings: { create: typeof create };
    constructor() {
      this.embeddings = { create };
    }
  };
  return { default: MockOpenAI };
});

vi.mock("@/credentials/services", () => ({
  resolveApiKey: vi.fn(async () => "sk-test"),
}));

vi.mock("@/settings/services", () => ({
  getAISettings: vi.fn(async () => ({
    reportProvider: "openrouter",
    reportModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
    embeddingProvider: "openrouter",
    embeddingModel: "openai/text-embedding-3-small",
  })),
}));

vi.mock("@/config/env", () => ({
  env: {
    OPENROUTER_API_KEY: "",
    OLLAMA_BASE_URL: "http://localhost:11434",
    OLLAMA_API_KEY: "",
  },
}));

import OpenAI from "openai";
import { embedTexts } from "@/projects/embeddings";
import { resolveApiKey } from "@/credentials/services";

const mockCreate = (new OpenAI() as any).embeddings.create;

describe("embedTexts", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    vi.mocked(resolveApiKey).mockClear();
  });

  it("returns vectors in input order regardless of response order", async () => {
    mockCreate.mockResolvedValue({
      data: [
        { index: 1, embedding: Array.from({ length: 768 }, (_, i) => i + 1) },
        { index: 0, embedding: Array.from({ length: 768 }, (_, i) => -(i + 1)) },
      ],
    });

    const vectors = await embedTexts(["second", "first"]);

    expect(vectors).toHaveLength(2);
    expect(vectors[0][0]).toBe(-1);
    expect(vectors[1][0]).toBe(1);
  });

  it("requests the configured embedding dimensions", async () => {
    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: Array.from({ length: 768 }, () => 0) }],
    });

    await embedTexts(["x"]);

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ dimensions: 768 }),
    );
  });

  it("throws when the model returns the wrong number of dimensions", async () => {
    mockCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1, 2, 3] }] });

    await expect(embedTexts(["x"])).rejects.toThrow("expected 768");
  });

  it("skips dimensions param for ollama provider", async () => {
    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: Array.from({ length: 768 }, () => 0.5) }],
    });

    await embedTexts(["x"], { provider: "ollama" });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ dimensions: expect.anything() }),
    );
  });
});
