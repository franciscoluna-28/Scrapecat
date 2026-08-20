import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnsureArchive = vi.fn();
const mockListCommitsInRange = vi.fn();
const mockGetCommitDiffStats = vi.fn();
const mockUpsertCommitChunks = vi.fn();
const mockGetChunksByShas = vi.fn();
const mockEmbedNewChunks = vi.fn();

vi.mock("@/repositories/archive-service", () => ({
  ensureArchive: (...args: unknown[]) => mockEnsureArchive(...args),
}));

vi.mock("@/repositories/git-reader", () => ({
  listCommitsInRange: (...args: unknown[]) => mockListCommitsInRange(...args),
}));

vi.mock("@/repositories/git-diff", () => ({
  getCommitDiffStats: (...args: unknown[]) => mockGetCommitDiffStats(...args),
}));

vi.mock("@/projects/stores/commit-chunks-store", () => ({
  getChunksByShas: (...args: unknown[]) => mockGetChunksByShas(...args),
  upsertCommitChunks: (...args: unknown[]) => mockUpsertCommitChunks(...args),
}));

vi.mock("@/projects/embed-chunks", () => ({
  embedNewChunks: (...args: unknown[]) => mockEmbedNewChunks(...args),
}));

import { ingestCommits } from "@/repositories/ingest";
import type { CommitDiffStats } from "@/repositories/git-diff";

const BASE_DIFF: CommitDiffStats = {
  filesChanged: 1,
  additions: 2,
  deletions: 1,
  files: [{ filepath: "a.txt", status: "modified", additions: 2, deletions: 1 }],
};

const baseCommit = {
  sha: "a",
  message: "fix: bug in parser",
  author: "t",
  date: "2026-01-01T00:00:00Z",
  tree: "t1",
  parentSha: null,
};

beforeEach(() => {
  mockEnsureArchive.mockReset();
  mockListCommitsInRange.mockReset();
  mockGetCommitDiffStats.mockReset();
  mockUpsertCommitChunks.mockReset();
  mockGetChunksByShas.mockReset();
  mockEmbedNewChunks.mockReset();
});

describe("ingestCommits", () => {
  it("ingests new commits with diff-derived metadata and validation", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/repo", tipSha: "tip123" });
    mockListCommitsInRange.mockResolvedValue([baseCommit]);
    mockGetChunksByShas.mockResolvedValue(new Map());
    mockGetCommitDiffStats.mockResolvedValue(BASE_DIFF);
    mockEmbedNewChunks.mockResolvedValue({ embedded: 1 });

    const result = await ingestCommits({
      owner: "owner",
      repo: "repo",
      branch: "main",
      projectId: "proj",
      startDate: new Date("2026-01-01T00:00:00Z"),
      endDate: new Date("2026-01-31T00:00:00Z"),
    });

    expect(result).toEqual({ commitsFound: 1, chunksWritten: 1, tipSha: "tip123" });
    expect(mockGetCommitDiffStats).toHaveBeenCalledWith({
      dir: "/repo",
      parentSha: null,
      commitSha: "a",
    });
    expect(mockUpsertCommitChunks).toHaveBeenCalledWith({
      inputs: [
        {
          projectId: "proj",
          commitSha: "a",
          branch: "main",
          commitMessage: "fix: bug in parser",
          author: "t",
          diffSummary: "fix: bug in parser",
          metadata: {
            filesChanged: ["a.txt"],
            fileStats: [{ filepath: "a.txt", status: "modified", additions: 2, deletions: 1 }],
            additions: 2,
            deletions: 1,
            commitUrl: "https://github.com/owner/repo/commit/a",
            validation: { status: "confirmed", notes: [] },
          },
          committedAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
    });
    expect(mockEmbedNewChunks).toHaveBeenCalledWith("proj");
  });

  it("flags commits whose message is uninformative", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/repo", tipSha: "tip123" });
    mockListCommitsInRange.mockResolvedValue([
      { ...baseCommit, sha: "b", message: "fix: lol" },
    ]);
    mockGetChunksByShas.mockResolvedValue(new Map());
    mockGetCommitDiffStats.mockResolvedValue({ ...BASE_DIFF, filesChanged: 12 });
    mockEmbedNewChunks.mockResolvedValue({ embedded: 1 });

    await ingestCommits({
      owner: "owner",
      repo: "repo",
      branch: "main",
      projectId: "proj",
    });

    const [call] = mockUpsertCommitChunks.mock.calls;
    const meta = call[0].inputs[0].metadata;
    expect(meta.validation.status).toBe("flagged");
    expect(meta.validation.notes.length).toBeGreaterThan(0);
  });

  it("skips commits with no file changes (empty/no-op)", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/repo", tipSha: "tip123" });
    mockListCommitsInRange.mockResolvedValue([baseCommit]);
    mockGetChunksByShas.mockResolvedValue(new Map());
    mockGetCommitDiffStats.mockResolvedValue({
      filesChanged: 0,
      additions: 0,
      deletions: 0,
      files: [],
    });

    const result = await ingestCommits({
      owner: "owner",
      repo: "repo",
      branch: "main",
      projectId: "proj",
    });

    expect(result).toEqual({ commitsFound: 1, chunksWritten: 0, tipSha: "tip123" });
    expect(mockUpsertCommitChunks).not.toHaveBeenCalled();
    expect(mockEmbedNewChunks).not.toHaveBeenCalled();
  });

  it("skips commits that already exist without diffing them", async () => {
    mockEnsureArchive.mockResolvedValue({ dir: "/repo", tipSha: "tip123" });
    mockListCommitsInRange.mockResolvedValue([baseCommit]);
    mockGetChunksByShas.mockResolvedValue(new Map([["a", {} as any]]));

    const result = await ingestCommits({ owner: "o", repo: "r", branch: "main", projectId: "proj" });

    expect(result).toEqual({ commitsFound: 1, chunksWritten: 0, tipSha: "tip123" });
    expect(mockGetCommitDiffStats).not.toHaveBeenCalled();
    expect(mockUpsertCommitChunks).not.toHaveBeenCalled();
    expect(mockEmbedNewChunks).not.toHaveBeenCalled();
  });
});
