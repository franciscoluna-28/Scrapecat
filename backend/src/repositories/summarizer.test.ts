import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCallAI = vi.fn();
const mockResolveApiKey = vi.fn();

vi.mock("@/reports/ai", () => ({
  callAI: (...args: unknown[]) => mockCallAI(...args),
}));

vi.mock("@/credentials/services", () => ({
  resolveApiKey: (...args: unknown[]) => mockResolveApiKey(...args),
}));

import {
  summarizeCommits,
  fallbackSummary,
  type SummarizableCommit,
} from "@/repositories/summarizer";

beforeEach(() => {
  mockCallAI.mockReset();
  mockResolveApiKey.mockReset();
  mockResolveApiKey.mockResolvedValue(null);
});

function commit(sha: string): SummarizableCommit {
  return {
    sha,
    message: `msg ${sha}`,
    author: "tester",
    date: "2026-01-01T00:00:00.000Z",
    diff: { filesChanged: ["a.ts"], additions: 2, deletions: 1, patch: `+a\n-b\n` },
  };
}

describe("fallbackSummary", () => {
  it("builds a structural summary from message and file stats", () => {
    const s = fallbackSummary(commit("abc"));
    expect(s.sha).toBe("abc");
    expect(s.summary).toContain("msg abc");
    expect(s.summary).toContain("a.ts");
    expect(s.validated).toBe(false);
  });
});

describe("summarizeCommits", () => {
  it("falls back when no API key is available", async () => {
    const results = await summarizeCommits([commit("a")]);
    expect(results[0].validated).toBe(false);
    expect(results[0].summary).toContain("msg a");
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it("parses a valid JSON array and maps by sha across batches", async () => {
    mockResolveApiKey.mockResolvedValue("sk-stored");
    mockCallAI.mockImplementation(async ({ messages }: any) => {
      const body = messages[1].content;
      const shas = [...body.matchAll(/# Commit \d+ — ([a-z0-9]+)/g)].map((m) => m[1]);
      return {
        content: JSON.stringify(
          shas.map((sha) => ({
            sha,
            summary: `Verified ${sha}`,
            validated: sha !== "b",
            notes: sha === "b" ? ["suspicious"] : [],
          })),
        ),
      };
    });

    const results = await summarizeCommits([commit("a"), commit("b"), commit("c")]);
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ sha: "a", summary: "Verified a", validated: true });
    expect(results[1]).toMatchObject({ sha: "b", validated: false, notes: ["suspicious"] });
    expect(results[2]).toMatchObject({ sha: "c", summary: "Verified c" });
    expect(mockCallAI).toHaveBeenCalledTimes(2);
  });

  it("falls back per-commit when the model returns invalid JSON", async () => {
    mockResolveApiKey.mockResolvedValue("sk-stored");
    mockCallAI.mockResolvedValue({ content: "not json at all" });
    const results = await summarizeCommits([commit("a")]);
    expect(results[0].validated).toBe(false);
    expect(results[0].summary).toContain("msg a");
  });

  it("falls back per-commit when the model response is missing a sha", async () => {
    mockResolveApiKey.mockResolvedValue("sk-stored");
    mockCallAI.mockResolvedValue({
      content: JSON.stringify([{ sha: "other", summary: "x", validated: true, notes: [] }]),
    });
    const results = await summarizeCommits([commit("a")]);
    expect(results[0].sha).toBe("a");
    expect(results[0].validated).toBe(false);
  });

  it("falls back when the AI call throws", async () => {
    mockResolveApiKey.mockResolvedValue("sk-stored");
    mockCallAI.mockRejectedValue(new Error("provider down"));
    const results = await summarizeCommits([commit("a")]);
    expect(results[0].validated).toBe(false);
  });
});
