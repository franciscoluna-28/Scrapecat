import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ABSTAIN_COSINE_DISTANCE,
  createRetriever,
  MAX_COSINE_DISTANCE,
  RELATIVE_FALLBACK_DAYS,
  RETRIEVAL_LIMIT,
  TEMPORAL_CONTEXT_LIMIT,
} from "@/rag/retrieval/retrieve";

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

const lexicalRow = { ...row, distance: null };

function makeRow(commitSha: string, distance: number | null = 0.1) {
  return { ...row, commitSha, distance };
}

function makeRetriever() {
  const embed = vi.fn();
  const resolveSpace = vi.fn();
  const store = {
    countChunksForProject: vi.fn(),
    semanticSearchCommits: vi.fn(),
    lexicalSearchCommits: vi.fn(),
    listCommitsInWindow: vi.fn(),
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
    deps.store.countChunksForProject.mockResolvedValue(5);
    deps.store.lexicalSearchCommits.mockResolvedValue([]);
  });

  it("fuses semantic and lexical rankings with RRF", async () => {
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([
      makeRow("a"),
      makeRow("b"),
    ]);
    deps.store.lexicalSearchCommits.mockResolvedValue([
      { ...lexicalRow, commitSha: "b" },
      { ...lexicalRow, commitSha: "c" },
    ]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "what changed",
    });

    expect(deps.store.semanticSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", limit: RETRIEVAL_LIMIT * 4 }),
    );
    expect(deps.store.lexicalSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "p1", limit: RETRIEVAL_LIMIT * 4 }),
    );
    expect(result.map((citation) => citation.commitSha)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("dedupes a SHA that appears in both channels", async () => {
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([row]);
    deps.store.lexicalSearchCommits.mockResolvedValue([lexicalRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      commitSha: "abc123",
      commitMessage: "add rag chat",
      author: "dev",
      committedAt: "2024-01-01T00:00:00.000Z",
      filesChanged: ["src/chat/routes.ts"],
      commitUrl: "https://github.com/o/r/commit/abc123",
    });
  });

  it("uses lexical only when embeddings are unavailable", async () => {
    deps.resolveSpace.mockResolvedValue(null);
    deps.store.lexicalSearchCommits.mockResolvedValue([lexicalRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(deps.embed).not.toHaveBeenCalled();
    expect(deps.store.semanticSearchCommits).not.toHaveBeenCalled();
    expect(deps.store.countChunksForProject).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("uses lexical only when there are no embeddings", async () => {
    deps.store.countChunksForProject.mockResolvedValue(0);
    deps.store.lexicalSearchCommits.mockResolvedValue([lexicalRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(deps.embed).not.toHaveBeenCalled();
    expect(deps.store.semanticSearchCommits).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("degrades to lexical when semantic search fails", async () => {
    deps.embed.mockRejectedValue(new Error("no key"));
    deps.store.lexicalSearchCommits.mockResolvedValue([lexicalRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(result).toHaveLength(1);
  });

  it("degrades to semantic when lexical search fails", async () => {
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([row]);
    deps.store.lexicalSearchCommits.mockRejectedValue(new Error("db down"));

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(result).toEqual([expect.objectContaining({ commitSha: "abc123" })]);
  });

  it("drops semantic hits outside the cosine distance ceiling", async () => {
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([
      { ...row, commitSha: "close", distance: 0.2 },
      { ...row, commitSha: "far", distance: MAX_COSINE_DISTANCE + 0.15 },
    ]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(result.map((citation) => citation.commitSha)).toEqual(["close"]);
  });

  it("returns empty when both channels fail", async () => {
    deps.embed.mockRejectedValue(new Error("no key"));
    deps.store.lexicalSearchCommits.mockRejectedValue(new Error("db down"));

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "nope",
    });

    expect(result).toEqual([]);
  });

  it("abstains when semantic evidence is weak and lexical finds nothing", async () => {
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([
      { ...row, commitSha: "weak", distance: ABSTAIN_COSINE_DISTANCE + 0.05 },
    ]);
    deps.store.lexicalSearchCommits.mockResolvedValue([]);

    const result = await deps.retriever.retrieveDetailed({
      projectId: "p1",
      query: "which kubernetes settings did we tune",
    });

    expect(result.citations).toEqual([]);
    expect(result.trace.abstained).toBe(true);
  });

  it("uses the full window for temporal summary questions", async () => {
    const startDate = new Date("2026-10-01T00:00:00.000Z");
    const endDate = new Date("2026-10-31T23:59:59.999Z");
    deps.store.listCommitsInWindow.mockResolvedValue([row]);

    const result = await deps.retriever.retrieveDetailed({
      projectId: "p1",
      query: "What did we ship in October 2026?",
      startDate,
      endDate,
    });

    expect(deps.store.listCommitsInWindow).toHaveBeenCalledWith({
      projectId: "p1",
      branch: undefined,
      startDate,
      endDate,
      limit: TEMPORAL_CONTEXT_LIMIT + 1,
    });
    expect(deps.store.semanticSearchCommits).not.toHaveBeenCalled();
    expect(deps.store.lexicalSearchCommits).not.toHaveBeenCalled();
    expect(result.trace.mode).toBe("temporal");
    expect(result.citations).toHaveLength(1);
  });

  it("forwards date window filters to both channels", async () => {
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
    expect(deps.store.lexicalSearchCommits).toHaveBeenCalledWith(
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
    deps.store.lexicalSearchCommits.mockResolvedValue([lexicalRow]);

    const result = await deps.retriever.resolveScope({
      projectId: "p1",
      query: "latest changes",
      branch: "main",
    });

    expect(deps.latestCommitDate).toHaveBeenCalledWith({
      projectId: "p1",
      branch: "main",
    });
    expect(deps.store.lexicalSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        branch: "main",
        startDate: new Date(
          latest.getTime() - RELATIVE_FALLBACK_DAYS * 86_400_000,
        ),
        endDate: latest,
      }),
    );
    expect(result).toMatchObject({
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
    expect(result.trace.mode).toBe("hybrid");
  });

  it("retries a relative window anchored at the latest commit when empty", async () => {
    const deps = makeRetriever();
    deps.resolveSpace.mockRejectedValue(new Error("db down"));
    deps.latestCommitDate.mockResolvedValue(latest);
    deps.store.lexicalSearchCommits
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([lexicalRow]);

    const result = await deps.retriever.resolveScope({
      projectId: "p1",
      query: "last 30 days",
      branch: "main",
    });

    expect(deps.store.lexicalSearchCommits).toHaveBeenCalledTimes(2);
    expect(deps.store.lexicalSearchCommits).toHaveBeenLastCalledWith(
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
    deps.store.lexicalSearchCommits.mockResolvedValue([]);

    const result = await deps.retriever.resolveScope({
      projectId: "p1",
      query: "last 30 days",
    });

    expect(deps.store.lexicalSearchCommits).toHaveBeenCalledTimes(1);
    expect(result.citations).toEqual([]);
  });
});
