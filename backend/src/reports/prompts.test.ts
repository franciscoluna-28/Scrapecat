import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  getLanguageInstruction,
  buildReportPrompt,
  buildRefinePrompt,
  FALLBACK_REPORT,
} from "@/reports/prompts";

describe("buildSystemPrompt", () => {
  it("returns prompt with custom instructions when provided", () => {
    const result = buildSystemPrompt("Be concise");
    expect(result).toContain("Be concise");
    expect(result).toContain("Senior Product Manager");
    expect(result).toContain("Product Update");
  });

  it("returns base prompt when no custom instructions", () => {
    const result = buildSystemPrompt(undefined);
    expect(result).not.toContain("User Specifications");
    expect(result).toContain("Product Update");
  });
});

describe("getLanguageInstruction", () => {
  it("returns language detection instruction when custom instructions given", () => {
    const result = getLanguageInstruction("Responda em português");
    expect(result).toContain("Detect the language");
  });

  it("returns English instruction when no custom instructions", () => {
    const result = getLanguageInstruction(undefined);
    expect(result).toBe("Write the report in English.");
  });
});

describe("buildReportPrompt", () => {
  const base = {
    repository: "test-repo",
    branch: "main",
    startDate: "2024-01-01",
    endDate: "2024-01-31",
    commits: [
      { message: "fix: bug", sha: "abc123", date: "2024-01-15", author: "dev" },
    ],
    languageInstruction: "",
  };

  it("includes repository and branch info", () => {
    const result = buildReportPrompt(base);
    expect(result).toContain("test-repo");
    expect(result).toContain("main");
  });

  it("includes commit messages", () => {
    const result = buildReportPrompt(base);
    expect(result).toContain("fix: bug");
  });
});

describe("buildRefinePrompt", () => {
  it("wraps user reply in refinement prompt", () => {
    const result = buildRefinePrompt("Make it shorter");
    expect(result).toContain("Make it shorter");
    expect(result).toContain("Refine the report");
    expect(result).toContain("template");
  });
});

describe("FALLBACK_REPORT", () => {
  it("is a non-empty string", () => {
    expect(typeof FALLBACK_REPORT).toBe("string");
    expect(FALLBACK_REPORT.length).toBeGreaterThan(0);
  });
});
