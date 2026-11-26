import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  DEFAULT_RETRIEVAL_LIMIT,
  MAX_COSINE_DISTANCE,
  MAX_RETRIEVAL_LIMIT,
  TEMPORAL_CONTEXT_LIMIT,
} from "@/rag/constants";
import { createRetriever } from "@/rag/retrieval/retrieve";

const row = {
  repoId: "p1",
  branch: "main",
  commitSha: "abc123",
  message: "add rag chat",
  summary: "Adds RAG chat retrieval and citations.",
  author: "dev",
  committedAt: new Date("2024-01-01T00:00:00.000Z"),
  filesChanged: ["src/chat/routes.ts"],
  commitUrl: "https://github.com/o/r/commit/abc123",
  distance: 0.1 as number | null,
};

const lexicalRow = { ...row, distance: null };

function makeRow(commitSha: string, distance: number | null = 0.1) {
  return { ...row, commitSha, distance };
}

function makeRetriever() {
  const embed = vi.fn();
  const resolveSpace = vi.fn();
  const store = {
    countCommitsForProject: vi.fn(),
    semanticSearchCommits: vi.fn(),
    lexicalSearchCommits: vi.fn(),
    listCommitsInWindow: vi.fn(),
  };

  const retriever = createRetriever({
    embed: embed as never,
    resolveSpace: resolveSpace as never,
    store: store as never,
  });

  return { retriever, embed, resolveSpace, store };
}

describe("retriever.retrieve", () => {
  let deps: ReturnType<typeof makeRetriever>;

  beforeEach(() => {
    deps = makeRetriever();
    deps.resolveSpace.mockResolvedValue({
      provider: "openrouter",
      model: "openai/text-embedding-3-small",
    });
    deps.store.countCommitsForProject.mockResolvedValue(5);
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
      expect.objectContaining({
        repoId: "p1",
        limit: DEFAULT_RETRIEVAL_LIMIT * 4,
      }),
    );
    expect(deps.store.lexicalSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: "p1",
        limit: DEFAULT_RETRIEVAL_LIMIT * 4,
      }),
    );
    expect(result.map((citation) => citation.commitSha)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("dedupes a SHA and exposes the summary in the citation", async () => {
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([row]);
    deps.store.lexicalSearchCommits.mockResolvedValue([lexicalRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(result).toEqual([
      {
        commitSha: "abc123",
        commitMessage: "add rag chat",
        summary: "Adds RAG chat retrieval and citations.",
        author: "dev",
        committedAt: "2024-01-01T00:00:00.000Z",
        filesChanged: ["src/chat/routes.ts"],
        commitUrl: "https://github.com/o/r/commit/abc123",
      },
    ]);
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
    expect(deps.store.countCommitsForProject).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("uses lexical only when there are no embeddings", async () => {
    deps.store.countCommitsForProject.mockResolvedValue(0);
    deps.store.lexicalSearchCommits.mockResolvedValue([lexicalRow]);

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(deps.embed).not.toHaveBeenCalled();
    expect(deps.store.semanticSearchCommits).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it("uses semantic only when lexical fails", async () => {
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([row]);
    deps.store.lexicalSearchCommits.mockRejectedValue(new Error("db down"));

    const result = await deps.retriever.retrieve({
      projectId: "p1",
      query: "chat",
    });

    expect(result).toEqual([expect.objectContaining({ commitSha: "abc123" })]);
  });

  it("drops semantic hits above the single cosine ceiling", async () => {
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

  it("abstains when both channels return nothing", async () => {
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([]);
    deps.store.lexicalSearchCommits.mockResolvedValue([]);

    const result = await deps.retriever.retrieveDetailed({
      projectId: "p1",
      query: "which salesforce settings did we tune",
    });

    expect(result.citations).toEqual([]);
    expect(result.trace.abstained).toBe(true);
  });

  it("uses the whole window for temporal summary questions", async () => {
    const start = new Date("2026-10-01T00:00:00.000Z");
    const end = new Date("2026-10-31T23:59:59.999Z");
    deps.store.listCommitsInWindow.mockResolvedValue([row]);

    const result = await deps.retriever.retrieveDetailed({
      projectId: "p1",
      query: "What did we ship in October?",
      startDate: start,
      endDate: end,
    });

    expect(deps.store.listCommitsInWindow).toHaveBeenCalledWith({
      repoId: "p1",
      branch: undefined,
      startDate: start,
      endDate: end,
      limit: TEMPORAL_CONTEXT_LIMIT + 1,
    });
    expect(deps.store.semanticSearchCommits).not.toHaveBeenCalled();
    expect(deps.store.lexicalSearchCommits).not.toHaveBeenCalled();
    expect(result.trace.mode).toBe("temporal");
  });

  it("caps the requested limit", async () => {
    deps.embed.mockResolvedValue([[0.1, 0.2]]);
    deps.store.semanticSearchCommits.mockResolvedValue([row]);

    await deps.retriever.retrieveDetailed({
      projectId: "p1",
      query: "chat",
      limit: 999,
    });

    expect(deps.store.semanticSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({ limit: MAX_RETRIEVAL_LIMIT * 4 }),
    );
  });
});

describe("retriever.resolveScope", () => {
  it("parses explicit date windows and forwards them", async () => {
    const deps = makeRetriever();
    deps.resolveSpace.mockResolvedValue(null);
    deps.store.lexicalSearchCommits.mockResolvedValue([lexicalRow]);

    const result = await deps.retriever.resolveScope({
      projectId: "p1",
      query: "When did the chat system change since June 2024?",
      branch: "main",
    });

    expect(result.startDate).toEqual(new Date("2024-06-01T00:00:00.000Z"));
    expect(deps.store.lexicalSearchCommits).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: "p1",
        branch: "main",
        startDate: new Date("2024-06-01T00:00:00.000Z"),
      }),
    );
  });
});
