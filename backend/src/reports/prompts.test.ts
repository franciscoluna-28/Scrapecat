import { describe, it, expect } from "vitest";
import {
  buildSystemPrompt,
  getLanguageInstruction,
  buildReportPrompt,
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
      {
        sha: "abc",
        message: "fix: bug",
        summary: "Fixed a bug in the parser",
        files: ["src/parser.ts"],
        filesChanged: 1,
        commitUrl: "https://github.com/o/r/commit/abc",
        flagged: false,
      },
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

  it("grounds commits on the actual file scope", () => {
    const result = buildReportPrompt(base);
    expect(result).toContain("src/parser.ts");
    expect(result).toContain("1 changed");
    expect(result).toContain("Commit: https://github.com/o/r/commit/abc");
  });

  it("flags uninformative commits in the prompt", () => {
    const result = buildReportPrompt({
      ...base,
      commits: [
        {
          sha: "b",
          message: "fix: lol",
          summary: "fix: lol",
          files: ["a.ts"],
          filesChanged: 1,
          commitUrl: null,
          flagged: true,
        },
      ],
    });
    expect(result).toContain("Note: the commit message looks uninformative");
  });

  it("caps the file list at 10 entries", () => {
    const files = Array.from({ length: 12 }, (_, i) => `f${i}.ts`);
    const result = buildReportPrompt({
      ...base,
      commits: [
        {
          sha: "c",
          message: "big change",
          summary: "big change",
          files,
          filesChanged: 12,
          commitUrl: null,
          flagged: false,
        },
      ],
    });
    expect(result).toContain("f9.ts");
    expect(result).toContain(", +2 more");
    expect(result).not.toContain("f10.ts");
  });
});
