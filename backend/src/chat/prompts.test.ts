import { describe, expect, it } from "vitest";
import { buildAskPrompt } from "@/chat/prompts";

describe("buildAskPrompt", () => {
  it("formats sources with short sha, author, message and summary", () => {
    const prompt = buildAskPrompt({
      question: "What changed in reports?",
      sources: [
        {
          id: "c1",
          commitSha: "abcdef1234567",
          commitMessage: "feat: add report replies",
          author: "franciscoluna-28",
          diffSummary: "feat: add report replies",
          committedAt: new Date(),
          similarity: 0.9,
        },
      ],
      repository: "commits-ai",
    });

    expect(prompt).toContain("Project: commits-ai");
    expect(prompt).toContain("Question: What changed in reports?");
    expect(prompt).toContain("(abcdef1, franciscoluna-28)");
    expect(prompt).toContain("feat: add report replies");
  });

  it("signals when nothing was retrieved", () => {
    const prompt = buildAskPrompt({
      question: "hi",
      sources: [],
      repository: "r",
    });
    expect(prompt).toContain("(none retrieved)");
  });
});
