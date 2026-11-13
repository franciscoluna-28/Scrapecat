import { describe, expect, it, vi } from "vitest";
import type { ChatCitation } from "@/db/schema";
import { createAnswerService } from "@/rag/answer/answer";

const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

const citation: ChatCitation = {
  commitSha: "abc123",
  commitMessage: "add rag chat",
  author: "dev",
  committedAt: "2024-01-01T00:00:00.000Z",
  filesChanged: ["src/chat/routes.ts"],
  commitUrl: "https://github.com/o/r/commit/abc123",
};

const messages = [
  { role: "system" as const, content: "system prompt" },
  { role: "user" as const, content: "retrieved context and question" },
];

function makeService() {
  const startDate = new Date("2026-01-01T00:00:00.000Z");
  const endDate = new Date("2026-02-01T00:00:00.000Z");
  const model = { provider: "openrouter", model: { id: "test-model" } };

  const resolveTurn = vi.fn().mockResolvedValue({
    project: { id: PROJECT_ID, repositoryName: "owner/repo" },
    branch: "main",
    scope: { citations: [citation], startDate, endDate },
    model,
    messages,
  });
  const generate = vi
    .fn()
    .mockResolvedValue({ content: "Summary", finishReason: "stop" });

  const service = createAnswerService({
    resolveTurn: resolveTurn as never,
    ai: { generate } as never,
  });

  return { service, resolveTurn, generate, model, startDate, endDate };
}

describe("createAnswerService", () => {
  it("resolves a turn and generates a stateless answer with citations", async () => {
    const { service, resolveTurn, generate, model, startDate, endDate } =
      makeService();
    const signal = new AbortController().signal;
    const input = {
      projectId: PROJECT_ID,
      query: "what changed?",
      persona: "cto",
      window: { startDate, endDate },
      signal,
    };

    const result = await service.answerQuestion(input);

    expect(resolveTurn).toHaveBeenCalledTimes(1);
    expect(resolveTurn).toHaveBeenCalledWith(input);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledWith({
      model,
      messages,
      abortSignal: signal,
    });
    expect(result).toEqual({
      content: "Summary",
      citations: [citation],
      branch: "main",
      persona: "cto",
      startDate,
      endDate,
    });
  });

  it("defaults the persona when the caller does not supply one", async () => {
    const { service, startDate, endDate } = makeService();

    const result = await service.answerQuestion({
      projectId: PROJECT_ID,
      query: "what changed?",
      window: { startDate, endDate },
    });

    expect(result.persona).toBe("founder");
  });

  it("propagates generation failures without persisting anything", async () => {
    const { service, resolveTurn, generate } = makeService();
    generate.mockRejectedValue(new Error("provider down"));

    await expect(
      service.answerQuestion({
        projectId: PROJECT_ID,
        query: "what changed?",
      }),
    ).rejects.toThrow("provider down");

    expect(resolveTurn).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
  });
});
