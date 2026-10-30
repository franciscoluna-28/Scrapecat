import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRetriever,
  RELATIVE_FALLBACK_DAYS,
  RETRIEVAL_LIMIT,
} from "@/chat/retrieval";

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

function makeRetriever() {
  const embed = vi.fn();
  const resolveSpace = vi.fn();
  const store = {
    countChunksForProject: vi.fn(),
    semanticSearchCommits: vi.fn(),
    keywordSearchCommits: vi.fn(),
  };
  const latestCommitDate = vi.fn();

  const retriever = createRetriever({
    embed: embed as never,
    resolveSpace: resolveSpace as never,
    store: store as never,
    latestCommitDate: latestCommitDate as never,
  });

  return { retriever, embed, resolveSpace, store, latestCommitDate };
}

describe("retriever.retrieve", () => {
  let deps: ReturnType<typeof makeRetriever>;

  beforeEach(() => {
    deps = makeRetriever();
    deps.resolveSpace.mockResolvedValue({
      provider: "openrouter",
      model: "openai/text-embedding-3-small",
    });
  });

  it("uses semantic search when embeddings exist", async () => {
    deps.store.countChunksForProject.mockResolvedValue(5);
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([row]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "what changed",
    });

    expect(deps.embed).toHaveBeenCalledWith(
      [expect.stringContaining("what changed")],
      expect.objectContaining({ provider: "openrouter" }),
    );
    expect(deps.store.semanticSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", limit: RETRIEVAL_LIMIT }),
    );
    expect(deps.store.countChunksForProject).toHaveBeenCalledWith(
      expect.objectContaining({
        embeddingSpace: {
          provider: "openrouter",
          model: "openai/text-embedding-3-small",
        },
      }),
    );
    expect(deps.store.keywordSearchCommits).not.toHaveBeenCalled();
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
    deps.store.countChunksForProject.mockResolvedValue(0);
    deps.store.keywordSearchCommits.mockResolvedValue([keywordRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(deps.embed).not.toHaveBeenCalled();
    expect(deps.store.keywordSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", limit: 10, query: "chat" }),
    );
    expect(result).toHaveLength(1);
  });

  it("falls back to keyword search when the embedding space cannot be resolved", async () => {
    deps.resolveSpace.mockRejectedValue(new Error("db down"));
    deps.store.keywordSearchCommits.mockResolvedValue([keywordRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(deps.store.countChunksForProject).not.toHaveBeenCalled();
    expect(deps.embed).not.toHaveBeenCalled();
    expect(deps.store.keywordSearchCommits).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("falls back to keyword search when embedding fails", async () => {
    deps.store.countChunksForProject.mockResolvedValue(5);
    deps.embed.mockRejectedValue(new Error("no key"));
    deps.store.semanticSearchCommits.mockResolvedValue([]);
    deps.store.keywordSearchCommits.mockResolvedValue([keywordRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(deps.store.keywordSearchCommits).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("falls back to keyword search when semantic search returns no rows", async () => {
    deps.store.countChunksForProject.mockResolvedValue(5);
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([]);
    deps.store.keywordSearchCommits.mockResolvedValue([keywordRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(deps.store.keywordSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", query: "chat" }),
    );
    expect(result).toHaveLength(1);
  });

  it("drops semantic hits outside the cosine distance ceiling", async () => {
    deps.store.countChunksForProject.mockResolvedValue(5);
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([
      { ...row, commitSha: "close", distance: 0.2 },
      { ...row, commitSha: "far", distance: 0.95 },
    ]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(result.map((citation) => citation.commitSha)).toEqual(["close"]);
  });

  it("returns empty when nothing matches", async () => {
    deps.store.countChunksForProject.mockResolvedValue(0);
    deps.store.keywordSearchCommits.mockResolvedValue([]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "nope",
    });

    expect(result).toEqual([]);
  });

  it("forwards date window filters to semantic search", async () => {
    deps.store.countChunksForProject.mockResolvedValue(5);
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([row]);

    const start = new Date("2026-08-01");
    const end = new Date("2026-08-31T23:59:59.999Z");

    await deps.retriever.retrieve({
      projectId: "p1",
      query: "august",
      startDate: start,
      endDate: end,
    });

    expect(deps.store.semanticSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: start, endDate: end }),
    );
  });
});

describe("retriever.resolveScope", () => {
  const latest = new Date("2026-08-15T12:00:00.000Z");

  it("anchors temporal intent at the latest commit", async () => {
    const deps = makeRetriever();
    deps.resolveSpace.mockRejectedValue(new Error("db down"));
    deps.latestCommitDate.mockResolvedValue(latest);
    deps.store.keywordSearchCommits.mockResolvedValue([keywordRow]);

    const result = await deps.retriever.resolveScope({
      projectId: "p1",
      query: "latest changes",
      branch: "main",
    });

    expect(deps.latestCommitDate).toHaveBeenCalledWith({
      projectId: "p1",
      branch: "main",
    });
    expect(deps.store.keywordSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        branch: "main",
        startDate: new Date(
          latest.getTime() - RELATIVE_FALLBACK_DAYS * 86_400_000,
        ),
        endDate: latest,
      }),
    );
    expect(result).toEqual({
      citations: [
        {
          commitSha: "abc123",
          commitMessage: "add rag chat",
          author: "dev",
          committedAt: "2024-01-01T00:00:00.000Z",
          filesChanged: ["src/chat/routes.ts"],
          commitUrl: "https://github.com/o/r/commit/abc123",
        },
      ],
      startDate: new Date(
        latest.getTime() - RELATIVE_FALLBACK_DAYS * 86_400_000,
      ),
      endDate: latest,
    });
  });

  it("retries a relative window anchored at the latest commit when empty", async () => {
    const deps = makeRetriever();
    deps.resolveSpace.mockRejectedValue(new Error("db down"));
    deps.latestCommitDate.mockResolvedValue(latest);
    deps.store.keywordSearchCommits
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([keywordRow]);

    const result = await deps.retriever.resolveScope({
      projectId: "p1",
      query: "last 30 days",
      branch: "main",
    });

    expect(deps.store.keywordSearchCommits).toHaveBeenCalledTimes(2);
    expect(deps.store.keywordSearchCommits).toHaveBeenLastCalledWith(
      expect.objectContaining({
        startDate: new Date(
          latest.getTime() - RELATIVE_FALLBACK_DAYS * 86_400_000,
        ),
        endDate: latest,
      }),
    );
    expect(result.citations).toHaveLength(1);
  });

  it("keeps an empty result when there is no latest commit to anchor to", async () => {
    const deps = makeRetriever();
    deps.resolveSpace.mockRejectedValue(new Error("db down"));
    deps.latestCommitDate.mockResolvedValue(null);
    deps.store.keywordSearchCommits.mockResolvedValue([]);

    const result = await deps.retriever.resolveScope({
      projectId: "p1",
      query: "last 30 days",
    });

    expect(deps.store.keywordSearchCommits).toHaveBeenCalledTimes(1);
    expect(result.citations).toEqual([]);
  });
});
