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
        files: [{ filepath: "src/parser.ts", status: "modified" as const, additions: 4, deletions: 2 }],
        filesChanged: 1,
        additions: 4,
        deletions: 2,
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

  it("grounds commits on the actual file scope with line counts", () => {
    const result = buildReportPrompt(base);
    expect(result).toContain("src/parser.ts (+4 -2)");
    expect(result).toContain("1 changed, +4 -2");
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
          files: [{ filepath: "a.ts", status: "modified" as const, additions: 1, deletions: 1 }],
          filesChanged: 1,
          additions: 1,
          deletions: 1,
          commitUrl: null,
          flagged: true,
        },
      ],
    });
    expect(result).toContain("Note: the commit message looks uninformative");
  });

  it("caps the file list at 10 entries", () => {
    const files = Array.from({ length: 12 }, (_, i) => ({
      filepath: `f${i}.ts`,
      status: "modified" as const,
      additions: 1,
      deletions: 0,
    }));
    const result = buildReportPrompt({
      ...base,
      commits: [
        {
          sha: "c",
          message: "big change",
          summary: "big change",
          files,
          filesChanged: 12,
          additions: 12,
          deletions: 0,
          commitUrl: null,
          flagged: false,
        },
      ],
    });
    expect(result).toContain("f9.ts (+1 -0)");
    expect(result).toContain(", +2 more");
    expect(result).not.toContain("f10.ts");
  });
});
