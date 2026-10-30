import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPendingRows = vi.fn();
const mockProjects = vi.fn();
const mockEmbedTexts = vi.fn();
const mockResolveEmbeddingSpace = vi.fn();
const mockUpdateChunkEmbeddings = vi.fn();

vi.mock("@/projects/stores/commit-chunks-store", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/projects/stores/commit-chunks-store")>();
  return {
    ...actual,
    commitChunksStore: {
      ...actual.commitChunksStore,
      listPendingChunks: (...args: unknown[]) => mockPendingRows(...args),
      listProjectIdsWithChunks: (...args: unknown[]) => mockProjects(...args),
      updateChunkEmbeddings: (...args: unknown[]) =>
        mockUpdateChunkEmbeddings(...args),
    },
  };
});

vi.mock("@/projects/embeddings", () => ({
  embedTexts: (...args: unknown[]) => mockEmbedTexts(...args),
  resolveEmbeddingSpace: (...args: unknown[]) => mockResolveEmbeddingSpace(...args),
}));

import {
  embedNewChunks,
  reindexAllProjects,
} from "@/projects/embed-chunks";

const SPACE = {
  provider: "openrouter",
  model: "openai/text-embedding-3-small",
};

const pending = {
  id: "chunk-1",
  commitMessage: "fix: handle empty commit",
  committedAt: new Date("2026-01-01T00:00:00.000Z"),
  contentHash: "hash-1",
};

describe("embedNewChunks", () => {
  beforeEach(() => {
    mockPendingRows.mockReset().mockResolvedValue([pending]);
    mockProjects.mockReset().mockResolvedValue([]);
    mockEmbedTexts.mockReset().mockResolvedValue([[0.1, 0.2]]);
    mockResolveEmbeddingSpace.mockReset().mockResolvedValue(SPACE);
    mockUpdateChunkEmbeddings.mockReset().mockResolvedValue(undefined);
  });

  it("embeds pending chunks in the current space", async () => {
    const result = await embedNewChunks("project-1");

    expect(result).toEqual({ embedded: 1 });
    expect(mockEmbedTexts).toHaveBeenCalledWith(
      ["2026-01-01 fix: handle empty commit"],
      SPACE,
    );
    expect(mockUpdateChunkEmbeddings).toHaveBeenCalledWith({
      updates: [
        {
          id: "chunk-1",
          embedding: [0.1, 0.2],
          contentHash: "hash-1",
        },
      ],
      space: SPACE,
    });
  });

  it("uses a supplied space without resolving settings again", async () => {
    await embedNewChunks("project-1", { space: SPACE });

    expect(mockResolveEmbeddingSpace).not.toHaveBeenCalled();
    expect(mockEmbedTexts).toHaveBeenCalledWith(expect.any(Array), SPACE);
  });

  it("does nothing when no chunks are pending", async () => {
    mockPendingRows.mockResolvedValue([]);

    await expect(embedNewChunks("project-1")).resolves.toEqual({ embedded: 0 });
    expect(mockEmbedTexts).not.toHaveBeenCalled();
    expect(mockUpdateChunkEmbeddings).not.toHaveBeenCalled();
  });
});

describe("reindexAllProjects", () => {
  beforeEach(() => {
    mockPendingRows.mockReset().mockResolvedValue([pending]);
    mockProjects.mockReset().mockResolvedValue([
      "project-1",
      "project-2",
    ]);
    mockEmbedTexts.mockReset().mockResolvedValue([[0.1, 0.2]]);
    mockResolveEmbeddingSpace.mockReset().mockResolvedValue(SPACE);
    mockUpdateChunkEmbeddings.mockReset().mockResolvedValue(undefined);
  });

  it("resolves the space once and reindexes every project", async () => {
    const result = await reindexAllProjects();

    expect(result).toEqual({
      provider: SPACE.provider,
      model: SPACE.model,
      projects: 2,
      embedded: 2,
    });
    expect(mockResolveEmbeddingSpace).toHaveBeenCalledTimes(1);
    expect(mockEmbedTexts).toHaveBeenCalledTimes(2);
  });

  it("continues with other projects when one project fails", async () => {
    mockEmbedTexts
      .mockRejectedValueOnce(new Error("provider down"))
      .mockResolvedValueOnce([[0.5]]);

    const result = await reindexAllProjects();

    expect(result).toEqual({
      provider: SPACE.provider,
      model: SPACE.model,
      projects: 2,
      embedded: 1,
    });
    expect(mockEmbedTexts).toHaveBeenCalledTimes(2);
  });
});
