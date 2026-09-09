import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEmbedTexts = vi.fn();
const mockCountChunks = vi.fn();
const mockSemanticSearch = vi.fn();
const mockKeywordSearch = vi.fn();

vi.mock("@/projects/embeddings", () => ({
  embedTexts: (...args: unknown[]) => mockEmbedTexts(...args),
}));

vi.mock("@/projects/stores/commit-chunks-store", () => ({
  countChunksForProject: (...args: unknown[]) => mockCountChunks(...args),
  semanticSearchCommits: (...args: unknown[]) => mockSemanticSearch(...args),
  keywordSearchCommits: (...args: unknown[]) => mockKeywordSearch(...args),
}));

import { MIN_SIMILARITY, WINDOWED_MIN_SIMILARITY, retrieveCommits } from "@/chat/retrieval";

const row = {
  id: "1",
  commitSha: "abc123",
  commitMessage: "add rag chat",
  author: "dev",
  committedAt: new Date("2024-01-01T00:00:00.000Z"),
  metadata: {
    filesChanged: ["src/chat/routes.ts"],
    commitUrl: "https://github.com/o/r/commit/abc123",
  },
  distance: 0.1,
};

const keywordRow = { ...row, distance: null };

describe("retrieveCommits", () => {
  beforeEach(() => {
    mockEmbedTexts.mockReset();
    mockCountChunks.mockReset();
    mockSemanticSearch.mockReset();
    mockKeywordSearch.mockReset();
  });

  it("uses semantic search when embeddings exist", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([row]);

    const result = await retrieveCommits({ projectId: "p1", query: "what changed" });

    expect(mockEmbedTexts).toHaveBeenCalledWith(["what changed"]);
    expect(mockSemanticSearch).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", limit: 120 }),
    );
    expect(mockKeywordSearch).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        commitSha: "abc123",
        commitMessage: "add rag chat",
        author: "dev",
        committedAt: "2024-01-01T00:00:00.000Z",
        filesChanged: ["src/chat/routes.ts"],
        commitUrl: "https://github.com/o/r/commit/abc123",
      },
    ]);
  });

  it("falls back to keyword search when no embeddings exist", async () => {
    mockCountChunks.mockResolvedValue(0);
    mockKeywordSearch.mockResolvedValue([keywordRow]);

    const result = await retrieveCommits({ projectId: "p1", query: "chat" });

    expect(mockEmbedTexts).not.toHaveBeenCalled();
    expect(mockKeywordSearch).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", query: "chat" }),
    );
    expect(result).toHaveLength(1);
  });

  it("falls back to keyword search when embedding fails", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockRejectedValue(new Error("no key"));
    mockSemanticSearch.mockResolvedValue([]);
    mockKeywordSearch.mockResolvedValue([keywordRow]);

    const result = await retrieveCommits({ projectId: "p1", query: "chat" });

    expect(mockKeywordSearch).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("returns empty when nothing matches", async () => {
    mockCountChunks.mockResolvedValue(0);
    mockKeywordSearch.mockResolvedValue([]);

    const result = await retrieveCommits({ projectId: "p1", query: "nope" });

    expect(result).toEqual([]);
  });

  it("drops semantic hits below the similarity floor", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([
      { ...row, commitSha: "strong", distance: 0.1 },
      { ...row, commitSha: "weak", distance: 0.9 },
      { ...row, commitSha: "borderline", distance: 1 - MIN_SIMILARITY },
    ]);

    const result = await retrieveCommits({ projectId: "p1", query: "rag chat" });

    expect(result.map((c) => c.commitSha)).toEqual(["strong", "borderline"]);
  });

  it("uses the relaxed floor for date-scoped questions", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([
      { ...row, commitSha: "borderline", distance: 1 - WINDOWED_MIN_SIMILARITY },
      { ...row, commitSha: "weak", distance: 0.95 },
    ]);

    const windowed = await retrieveCommits({
      projectId: "p1",
      query: "what shipped",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-08-31T23:59:59.999Z"),
    });
    expect(windowed.map((c) => c.commitSha)).toEqual(["borderline"]);

    const unwindowed = await retrieveCommits({ projectId: "p1", query: "what shipped" });
    expect(unwindowed).toEqual([]);
  });

  it("falls back to the window's most important commits when nothing clears the floor", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    // Both are topically weak (similarity 0.1) but "feat" outranks "chore".
    mockSemanticSearch.mockResolvedValue([
      { ...row, commitSha: "chore", commitMessage: "chore: tweak", distance: 0.9 },
      { ...row, commitSha: "feat", commitMessage: "feat: add thing", distance: 0.9 },
    ]);

    const result = await retrieveCommits({
      projectId: "p1",
      query: "what shipped in august 2026",
      startDate: new Date("2026-08-01T00:00:00.000Z"),
      endDate: new Date("2026-08-31T23:59:59.999Z"),
    });

    expect(result.map((c) => c.commitSha)).toEqual(["feat", "chore"]);
  });

  it("uses the real cosine similarity for ranking", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    // "chore" commit is more similar, but "feat" gets a large importance boost:
    // feat: 0.5 * 0.5 + 0.5 * 4 = 2.25 vs chore: 0.5 * 0.8 + 0.5 * 0.5 = 0.65
    mockSemanticSearch.mockResolvedValue([
      { ...row, commitSha: "chore", commitMessage: "chore: tweak", distance: 0.2 },
      { ...row, commitSha: "feat", commitMessage: "feat: add thing", distance: 0.5 },
    ]);

    const result = await retrieveCommits({ projectId: "p1", query: "rag chat" });

    expect(result.map((c) => c.commitSha)).toEqual(["feat", "chore"]);
  });
});
