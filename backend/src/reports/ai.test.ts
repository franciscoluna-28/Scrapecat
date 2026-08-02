import { describe, it, expect, vi, beforeEach } from "vitest";
import OpenAI from "openai";
import { callAI, cleanResponse } from "@/reports/ai";

vi.mock("openai", () => {
  const create = vi.fn();
  const MockOpenAI = class {
    chat: { completions: { create: typeof create } };
    constructor() {
      this.chat = { completions: { create } };
    }
  };
  return { default: MockOpenAI };
});

const getMockCreate = () => (new OpenAI() as any).chat.completions.create;

const REPORT = `# Product Update - Scrapecat

## Platform Architecture
- Migrated to a Fastify-based backend

### Strategic Direction
Positioned for scale.`;

describe("cleanResponse", () => {
  it("strips tagged thinking blocks", () => {
    const raw = `<thinking>Let me analyze the commits.\n\nGrouping changes into categories...</thinking>\n\n${REPORT}`;
    expect(cleanResponse(raw)).toBe(REPORT);
  });

  it("strips untagged reasoning preamble before the report", () => {
    const raw = `Let me analyze the raw activity data to create a high-level Product Update.

1. **Backend Architecture** - refactoring
2. **Security** - encryption

Now let me write the report:

${REPORT}`;
    expect(cleanResponse(raw)).toBe(REPORT);
  });

  it("keeps a clean report unchanged", () => {
    expect(cleanResponse(REPORT)).toBe(REPORT);
  });

  it("returns empty content unchanged", () => {
    expect(cleanResponse("")).toBe("");
  });

  it("strips case-insensitive and attribute-bearing thinking tags", () => {
    const raw = `<Thinking mode="full">reasoning here\nacross lines</Thinking>\n${REPORT}`;
    expect(cleanResponse(raw)).toBe(REPORT);
  });
});

describe("callAI", () => {
  beforeEach(() => {
    getMockCreate().mockReset();
  });

  it("returns content and finishReason for openai-compatible providers", async () => {
    getMockCreate().mockResolvedValue({
      choices: [
        { message: { content: "Generated report" }, finish_reason: "length" },
      ],
    });

    const result = await callAI({
      provider: "deepseek",
      apiKey: "test-key",
      model: "deepseek-chat",
      messages: [{ role: "user", content: "write a report" }],
    });

    expect(result.content).toBe("Generated report");
    expect(result.finishReason).toBe("length");
  });

  it("passes maxTokens through to the provider", async () => {
    getMockCreate().mockResolvedValue({
      choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
    });

    await callAI({
      provider: "deepseek",
      apiKey: "test-key",
      model: "deepseek-chat",
      maxTokens: 4096,
      messages: [{ role: "user", content: "write a report" }],
    });

    expect(getMockCreate().mock.calls[0][0].max_tokens).toBe(4096);
  });
});
