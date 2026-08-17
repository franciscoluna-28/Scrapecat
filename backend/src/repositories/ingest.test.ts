import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnsureArchive = vi.fn();
const mockListCommitsInRange = vi.fn();
const mockGetCommitDiff = vi.fn();
const mockSummarizeCommits = vi.fn();
const mockUpsertCommitChunks = vi.fn();
const mockGetChunksByShas = vi.fn();
const mockEmbedNewChunks = vi.fn();

vi.mock("@/repositories/archive-service", () => ({
  ensureArchive: (...args: unknown[]) => mockEnsureArchive(...args),
}));

vi.mock("@/repositories/git-reader", () => ({
  listCommitsInRange: (...args: unknown[]) => mockListCommitsInRange(...args),
  getCommitDiff: (...args: unknown[]) => mockGetCommitDiff(...args),
}));

vi.mock("@/repositories/summarizer", () => ({
  summarizeCommits: (...args: unknown[]) => mockSummarizeCommits(...args),
}));

vi.mock("@/projects/stores/commit-chunks-store", () => ({
  getChunksByShas: (...args: unknown[]) => mockGetChunksByShas(...args),
  upsertCommitChunks: (...args: unknown[]) => mockUpsertCommitChunks(...args),
}));

vi.mock("@/projects/embed-chunks", () => ({
  embedNewChunks: (...args: unknown[]) => mockEmbedNewChunks(...args),
}));

import { ingestCommits } from "@/repositories/ingest";

beforeEach(() => {
  mockEnsureArchive.mockReset();
  mockListCommitsInRange.mockReset();
  mockGetCommitDiff.mockReset();
  mockSummarizeCommits.mockReset();
  mockUpsertCommitChunks.mockReset();
  mockGetChunksByShas.mockReset();
  mockEmbedNewChunks.mockReset();
});

describe("ingestCommits", () => {
  it("ingests new commits end to end with summaries and metadata", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/repo", tipSha: "tip123" });
    mockListCommitsInRange.mockResolvedValue([
      { sha: "a", message: "fix a", author: "t", date: "2026-01-01T00:00:00Z", tree: "t1", parentSha: null },
    ]);
    mockGetChunksByShas.mockResolvedValue(new Map());
    mockGetCommitDiff.mockResolvedValue({
      filesChanged: ["x.ts"],
      additions: 3,
      deletions: 1,
      patch: "+a\n-b\n+c\n",
    });
    mockSummarizeCommits.mockResolvedValue([
      { sha: "a", summary: "Verified change in x.ts", validated: true, notes: [] },
    ]);
    mockEmbedNewChunks.mockResolvedValue({ embedded: 1 });

    const result = await ingestCommits({
      owner: "owner",
      repo: "repo",
      branch: "main",
      projectId: "proj",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-31T00:00:00Z"),
    });

    expect(result).toEqual({ commitsFound: 1, chunksWritten: 1, summarized: 1, tipSha: "tip123" });
    expect(mockUpsertCommitChunks).toHaveBeenCalledWith({
      inputs: [
        expect.objectContaining({
          projectId: "proj",
          commitSha: "a",
          branch: "main",
          commitMessage: "fix a",
          diffSummary: "Verified change in x.ts",
          diffPatch: "+a\n-b\n+c\n",
          metadata: expect.objectContaining({
            filesChanged: ["x.ts"],
            additions: 3,
            deletions: 1,
            validation: { status: "confirmed", notes: [] },
          }),
        }),
      ],
    });
    expect(mockEmbedNewChunks).toHaveBeenCalledWith("proj");
  });

  it("skips commits that already exist and re-embeds nothing when no new chunks", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/repo", tipSha: "tip123" });
    mockListCommitsInRange.mockResolvedValue([
      { sha: "a", message: "fix a", author: "t", date: "2026-01-01T00:00:00Z", tree: "t1", parentSha: null },
    ]);
    mockGetChunksByShas.mockResolvedValue(new Map([["a", {} as any]]));
    mockSummarizeCommits.mockResolvedValue([]);

    const result = await ingestCommits({ owner: "o", repo: "r", branch: "main", projectId: "proj" });

    expect(result).toEqual({ commitsFound: 1, chunksWritten: 0, summarized: 0, tipSha: "tip123" });
    expect(mockGetCommitDiff).not.toHaveBeenCalled();
    expect(mockUpsertCommitChunks).not.toHaveBeenCalled();
    expect(mockEmbedNewChunks).not.toHaveBeenCalled();
  });

  it("marks unvalidated summaries as flagged", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/repo", tipSha: "tip123" });
    mockListCommitsInRange.mockResolvedValue([
      { sha: "a", message: "fix a", author: "t", date: "2026-01-01T00:00:00Z", tree: "t1", parentSha: null },
    ]);
    mockGetChunksByShas.mockResolvedValue(new Map());
    mockGetCommitDiff.mockResolvedValue({ filesChanged: [], additions: 0, deletions: 0, patch: "" });
    mockSummarizeCommits.mockResolvedValue([
      { sha: "a", summary: "fallback", validated: false, notes: ["llm down"] },
    ]);
    mockEmbedNewChunks.mockResolvedValue({ embedded: 0 });

    await ingestCommits({ owner: "o", repo: "r", branch: "main", projectId: "proj" });

    expect(mockUpsertCommitChunks).toHaveBeenCalledWith({
      inputs: [
        expect.objectContaining({
          diffSummary: "fallback",
          metadata: expect.objectContaining({ validation: { status: "flagged", notes: ["llm down"] } }),
        }),
      ],
    });
  });
});
