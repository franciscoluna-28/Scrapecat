import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEmbedTexts = vi.fn();
const mockResolveEmbeddingSpace = vi.fn();
const mockCountChunks = vi.fn();
const mockSemanticSearch = vi.fn();
const mockKeywordSearch = vi.fn();

vi.mock("@/projects/embeddings", () => ({
  embedTexts: (...args: unknown[]) => mockEmbedTexts(...args),
  resolveEmbeddingSpace: (...args: unknown[]) => mockResolveEmbeddingSpace(...args),
}));

vi.mock("@/projects/stores/commit-chunks-store", () => ({
  commitChunksStore: {
    countChunksForProject: (...args: unknown[]) => mockCountChunks(...args),
    semanticSearchCommits: (...args: unknown[]) => mockSemanticSearch(...args),
    keywordSearchCommits: (...args: unknown[]) => mockKeywordSearch(...args),
  },
}));

import { RETRIEVAL_LIMIT, retrieveCommits } from "@/chat/retrieval";

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
    mockResolveEmbeddingSpace.mockReset();
    mockCountChunks.mockReset();
    mockSemanticSearch.mockReset();
    mockKeywordSearch.mockReset();
    mockResolveEmbeddingSpace.mockResolvedValue({
      provider: "openrouter",
      model: "openai/text-embedding-3-small",
    });
  });

  it("uses semantic search when embeddings exist", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([row]);

    const result = await retrieveCommits({ projectId: "p1", query: "what changed" });

    expect(mockEmbedTexts).toHaveBeenCalledWith(
      [expect.stringContaining("what changed")],
      expect.objectContaining({ provider: "openrouter" }),
    );
    expect(mockSemanticSearch).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", limit: RETRIEVAL_LIMIT }),
    );
    expect(mockCountChunks).toHaveBeenCalledWith(
      expect.objectContaining({
        embeddingSpace: {
          provider: "openrouter",
          model: "openai/text-embedding-3-small",
        },
      }),
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
      expect.objectContaining({ projectId: "p1", limit: 10, query: "chat" }),
    );
    expect(result).toHaveLength(1);
  });

  it("falls back to keyword search when the embedding space cannot be resolved", async () => {
    mockResolveEmbeddingSpace.mockRejectedValue(new Error("db down"));
    mockKeywordSearch.mockResolvedValue([keywordRow]);

    const result = await retrieveCommits({ projectId: "p1", query: "chat" });

    expect(mockCountChunks).not.toHaveBeenCalled();
    expect(mockEmbedTexts).not.toHaveBeenCalled();
    expect(mockKeywordSearch).toHaveBeenCalled();
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

  it("falls back to keyword search when semantic search returns no rows", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([]);
    mockKeywordSearch.mockResolvedValue([keywordRow]);

    const result = await retrieveCommits({ projectId: "p1", query: "chat" });

    expect(mockKeywordSearch).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", query: "chat" }),
    );
    expect(result).toHaveLength(1);
  });

  it("drops semantic hits outside the cosine distance ceiling", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([
      { ...row, commitSha: "close", distance: 0.2 },
      { ...row, commitSha: "far", distance: 0.95 },
    ]);

    const result = await retrieveCommits({ projectId: "p1", query: "chat" });

    expect(result.map((citation) => citation.commitSha)).toEqual(["close"]);
  });

  it("returns empty when nothing matches", async () => {
    mockCountChunks.mockResolvedValue(0);
    mockKeywordSearch.mockResolvedValue([]);

    const result = await retrieveCommits({ projectId: "p1", query: "nope" });

    expect(result).toEqual([]);
  });

  it("forwards date window filters to semantic search", async () => {
    mockCountChunks.mockResolvedValue(5);
    mockEmbedTexts.mockResolvedValue([[0.1, 0.2]]);
    mockSemanticSearch.mockResolvedValue([row]);

    const start = new Date("2026-08-01");
    const end = new Date("2026-08-31T23:59:59.999Z");

    await retrieveCommits({ projectId: "p1", query: "august", startDate: start, endDate: end });

    expect(mockSemanticSearch).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: start, endDate: end }),
    );
  });
});