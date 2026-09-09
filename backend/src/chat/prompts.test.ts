import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserMessage, formatCitationForPrompt } from "@/chat/prompts";
import type { ChatCitation } from "@/db/schema";

const citation: ChatCitation = {
  commitSha: "abc123",
  commitMessage: "add rag chat",
  author: "dev",
  committedAt: "2024-01-01T00:00:00.000Z",
  filesChanged: ["src/chat/routes.ts", "src/chat/services.ts"],
  commitUrl: "https://github.com/o/r/commit/abc123",
};

describe("chat prompts", () => {
  it("builds a system prompt with the repository name", () => {
    const prompt = buildSystemPrompt("scrapecat");
    expect(prompt).toContain("scrapecat");
    expect(prompt).toContain("retrieved commits");
  });

  it("anchors the system prompt to the current date", () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const prompt = buildSystemPrompt(null, now);
    expect(prompt).toContain("The current date is 2026-09-08");
    expect(prompt).toContain("MOST RECENT commits");
  });

  it("formats a citation with sha, message, and files", () => {
    const out = formatCitationForPrompt(citation);
    expect(out).toContain("abc123");
    expect(out).toContain("add rag chat");
    expect(out).toContain("src/chat/routes.ts");
    expect(out).toContain("https://github.com/o/r/commit/abc123");
  });

  it("caps the file list shown in a citation", () => {
    const manyFiles = Array.from({ length: 12 }, (_, i) => `src/f${i}.ts`);
    const out = formatCitationForPrompt({ ...citation, filesChanged: manyFiles });
    expect(out).toContain("+6 more");
  });

  it("builds a user message embedding the question and context", () => {
    const out = buildUserMessage("when was chat added?", [citation]);
    expect(out).toContain("when was chat added?");
    expect(out).toContain("abc123");
  });

  it("includes the present moment and recency guidance in the user message", () => {
    const now = new Date("2026-09-08T12:00:00.000Z");
    const start = new Date("2026-08-09T12:00:00.000Z");
    const out = buildUserMessage("What feature is being built?", [citation], {
      startDate: start,
      endDate: now,
      now,
    });
    expect(out).toContain(`Present moment: ${now.toISOString()}`);
    expect(out).toContain("closest to the \"To\" date");
    expect(out).toContain("What feature is being built?");
  });
});
