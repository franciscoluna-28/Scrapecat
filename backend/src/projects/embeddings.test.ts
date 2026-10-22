import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate, mockCtor } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockCtor: vi.fn(),
}));

vi.mock("openai", () => {
  const MockOpenAI = class {
    embeddings = { create: mockCreate };
    constructor(opts: unknown) {
      mockCtor(opts);
    }
  };
  return { default: MockOpenAI };
});

vi.mock("@/credentials/services", () => ({
  resolveApiKey: vi.fn(async () => "sk-test"),
}));

vi.mock("@/settings/services", () => ({
  getAISettings: vi.fn(async () => ({
    chatProvider: "openrouter",
    chatModel: "nvidia/nemotron-3-ultra-550b-a55b:free",
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

import { embedTexts } from "@/projects/embeddings";
import { resolveApiKey } from "@/credentials/services";

describe("embedTexts", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockCtor.mockReset();
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

  it("uses the configured provider and model", async () => {
    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: Array.from({ length: 768 }, () => 0) }],
    });

    await embedTexts(["x"]);

    expect(mockCtor).toHaveBeenCalledWith({
      apiKey: "sk-test",
      baseURL: "https://openrouter.ai/api/v1",
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "openai/text-embedding-3-small" }),
    );
  });

  it("honors an explicit provider and model override", async () => {
    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: Array.from({ length: 768 }, () => 0) }],
    });

    await embedTexts(["x"], {
      provider: "deepseek",
      model: "deepseek-v4-flash",
    });

    expect(mockCtor).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://api.deepseek.com/v1" }),
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "deepseek-v4-flash" }),
    );
  });

  it("does not call the provider for an empty input", async () => {
    await expect(embedTexts([])).resolves.toEqual([]);

    expect(mockCtor).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects an unsupported provider before creating a client", async () => {
    await expect(embedTexts(["x"], { provider: "not-a-provider" })).rejects.toThrow(
      "Unsupported embedding provider",
    );

    expect(mockCtor).not.toHaveBeenCalled();
  });

  it("throws when the model returns the wrong number of dimensions", async () => {
    mockCreate.mockResolvedValue({ data: [{ index: 0, embedding: [1, 2, 3] }] });

    await expect(embedTexts(["x"])).rejects.toThrow("expected 768");
  });

  it("throws when the response is missing an input index", async () => {
    mockCreate.mockResolvedValue({
      data: [{ index: 0, embedding: Array.from({ length: 768 }, () => 0) }],
    });

    await expect(embedTexts(["first", "second"])).rejects.toThrow(
      "missing index 1",
    );
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
