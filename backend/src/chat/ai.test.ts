import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateText, streamText } from "ai";
import { createLanguageModel } from "@/shared/integrations/providers/protocols";
import { callAI } from "@/chat/ai";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

vi.mock("@/shared/integrations/providers/protocols", () => ({
  createLanguageModel: vi.fn(),
}));

const baseRequest = {
  provider: "openai",
  apiKey: "test-key",
  messages: [
    { role: "system" as const, content: "Be concise." },
    { role: "user" as const, content: "What changed?" },
  ],
};

describe("callAI", () => {
  beforeEach(() => {
    vi.mocked(createLanguageModel).mockReturnValue({} as never);
  });

  it("passes system prompts separately and returns generated text", async () => {
    vi.mocked(generateText).mockResolvedValue({
      text: "Nothing yet.",
      finishReason: "stop",
    } as never);

    const result = await callAI(baseRequest);

    expect(result).toEqual({ content: "Nothing yet.", finishReason: "stop" });
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "Be concise.",
        messages: [{ role: "user", content: "What changed?" }],
        temperature: 0.1,
        maxOutputTokens: 4096,
      }),
    );
  });

  it("streams chunks and returns the accumulated text", async () => {
    vi.mocked(streamText).mockReturnValue({
      textStream: (async function* () {
        yield "No";
        yield "thing.";
      })(),
      text: Promise.resolve("Nothing."),
      finishReason: Promise.resolve("stop"),
    } as never);

    const chunks: string[] = [];
    const result = await callAI({
      ...baseRequest,
      onChunk: (chunk) => chunks.push(chunk),
    });

    expect(chunks).toEqual(["No", "thing."]);
    expect(result).toEqual({ content: "Nothing.", finishReason: "stop" });
  });
});
