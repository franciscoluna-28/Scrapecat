import { describe, expect, it, vi } from "vitest";
import type { generateText, streamText } from "ai";
import {
  createAIClient,
  DEFAULT_MAX_OUTPUT_TOKENS,
  type ResolvedChatModel,
} from "@/chat/ai";
import type { ModelDescriptor } from "@/shared/integrations/providers/catalog";
import type { ProviderConfig } from "@/shared/integrations/providers/registry";

const providerConfig: ProviderConfig = {
  label: "OpenAI",
  defaultModel: "gpt-4o",
  defaultProtocol: "openai-chat",
  envKey: "OPENAI_API_KEY",
  verifyUrl: "https://api.openai.com/v1/models",
  baseUrl: "https://api.openai.com/v1",
};

const modelDescriptor: ModelDescriptor = {
  id: "gpt-4o",
  name: "GPT-4o",
  protocol: "openai-chat",
  free: false,
  description: "",
};

const resolvedModel: ResolvedChatModel = {
  provider: "openai",
  config: providerConfig,
  model: modelDescriptor,
  apiKey: "test-key",
};

const baseRequest = {
  model: resolvedModel,
  messages: [
    { role: "system" as const, content: "Be concise." },
    { role: "user" as const, content: "What changed?" },
  ],
};

function makeClient(overrides: {
  generateText?: (...args: unknown[]) => unknown;
  streamText?: (...args: unknown[]) => unknown;
} = {}) {
  const generateTextMock = vi.fn(overrides.generateText);
  const streamTextMock = vi.fn(overrides.streamText);
  const createLanguageModelMock = vi.fn(() => ({}) as never);
  const logger = { error: vi.fn() };

  const client = createAIClient({
    generateText: generateTextMock as unknown as typeof generateText,
    streamText: streamTextMock as unknown as typeof streamText,
    createLanguageModel: createLanguageModelMock as never,
    timeoutMs: 120_000,
    logger,
  });

  return { client, generateTextMock, streamTextMock, createLanguageModelMock, logger };
}

describe("createAIClient", () => {
  it("passes system prompts separately and returns generated text", async () => {
    const { client, generateTextMock, createLanguageModelMock } = makeClient({
      generateText: async () => ({ text: "Nothing yet.", finishReason: "stop" }),
    });

    const result = await client.generate(baseRequest);

    expect(result).toEqual({ content: "Nothing yet.", finishReason: "stop" });
    expect(createLanguageModelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        config: providerConfig,
        model: modelDescriptor,
        apiKey: "test-key",
      }),
    );
    expect(generateTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "Be concise.",
        messages: [{ role: "user", content: "What changed?" }],
        temperature: 0.1,
        maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS,
      }),
    );
  });

  it("streams chunks and returns the accumulated text", async () => {
    const { client } = makeClient({
      streamText: () => ({
        textStream: (async function* () {
          yield "No";
          yield "thing.";
        })(),
        text: Promise.resolve("Nothing."),
        finishReason: Promise.resolve("stop"),
      }),
    });

    const chunks: string[] = [];
    const result = await client.stream(baseRequest, (chunk) => chunks.push(chunk));

    expect(chunks).toEqual(["No", "thing."]);
    expect(result).toEqual({ content: "Nothing.", finishReason: "stop" });
  });

  it("logs provider context and rethrows failures", async () => {
    const error = new Error("provider down");
    const { client, logger } = makeClient({
      generateText: async () => {
        throw error;
      },
    });

    await expect(client.generate(baseRequest)).rejects.toThrow("provider down");
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "openai", model: "gpt-4o" }),
      "AI request failed",
    );
  });
});
