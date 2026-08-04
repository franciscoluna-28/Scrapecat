import { describe, expect, it } from "vitest";
import { buildAskPrompt } from "@/chat/prompts";

describe("buildAskPrompt", () => {
  it("formats sources with short sha, author, date, message and summary", () => {
    const prompt = buildAskPrompt({
      question: "What changed in reports?",
      sources: [
        {
          id: "c1",
          commitSha: "abcdef1234567",
          commitMessage: "feat: add report replies",
          author: "franciscoluna-28",
          diffSummary: "feat: add report replies",
          committedAt: new Date("2026-07-31T10:00:00Z"),
          similarity: 0.9,
        },
      ],
      repository: "commits-ai",
    });

    expect(prompt).toContain("Project: commits-ai");
    expect(prompt).toContain("Question: What changed in reports?");
    expect(prompt).toContain("(abcdef1, franciscoluna-28, committed 2026-07-31)");
    expect(prompt).toContain("feat: add report replies");
  });

  it("includes the extracted time window when present", () => {
    const prompt = buildAskPrompt({
      question: "what was built in august 2026?",
      sources: [],
      repository: "r",
      dateFilter: { startDate: "2026-08-01", endDate: "2026-08-31", label: "August 2026" },
    });

    expect(prompt).toContain("Time window in question: August 2026");
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
