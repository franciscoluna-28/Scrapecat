import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetChunksByShas = vi.fn();
const mockUpsertCommitChunks = vi.fn();
const mockEmbedNewChunks = vi.fn();

vi.mock("@/projects/stores/commit-chunks-store", () => ({
  getChunksByShas: (...args: unknown[]) => mockGetChunksByShas(...args),
  upsertCommitChunks: (...args: unknown[]) => mockUpsertCommitChunks(...args),
}));

vi.mock("@/projects/embed-chunks", () => ({
  embedNewChunks: (...args: unknown[]) => mockEmbedNewChunks(...args),
}));

import { ingestCommits, type CommitSource, type SourceCommit } from "@/repositories/ingest";
import type { CommitChunkInput } from "@/projects/stores/commit-chunks-store";

function commit(sha: string): SourceCommit {
  return { sha, message: `msg ${sha}`, author: "t", date: "2026-01-01T00:00:00Z" };
}

function input(c: SourceCommit, projectId: string, branch: string): CommitChunkInput {
  return {
    projectId,
    commitSha: c.sha,
    branch,
    commitMessage: c.message,
    author: c.author,
    metadata: {},
    committedAt: new Date(c.date),
  };
}

function makeSource(
  commits: SourceCommit[],
  opts: { batchSize?: number; tipSha?: string; skippedShas?: string[] } = {},
): CommitSource {
  const skipped = new Set(opts.skippedShas ?? []);
  return {
    batchSize: opts.batchSize ?? 50,
    listCommits: vi.fn(async () => ({ commits, tipSha: opts.tipSha ?? "tip123" })),
    toChunkInputs: vi.fn(async (batch: SourceCommit[], ctx) => {
      const inputs = batch
        .filter((c) => !skipped.has(c.sha))
        .map((c) => input(c, ctx.projectId, ctx.branch));
      return { inputs, skipped: batch.length - inputs.length };
    }),
  };
}

const call = { owner: "owner", repo: "repo", branch: "main", projectId: "proj" };

beforeEach(() => {
  mockGetChunksByShas.mockReset().mockResolvedValue(new Map());
  mockUpsertCommitChunks.mockReset().mockResolvedValue(undefined);
  mockEmbedNewChunks.mockReset().mockResolvedValue({ embedded: 1 });
});

describe("ingestCommits", () => {
  it("enriches and upserts new commits, then embeds", async () => {
    const source = makeSource([commit("a")], { tipSha: "tip123" });

    const result = await ingestCommits(source, call);

    expect(result).toEqual({ commitsFound: 1, chunksWritten: 1, tipSha: "tip123" });
    expect(mockUpsertCommitChunks).toHaveBeenCalledWith({
      inputs: [input(commit("a"), "proj", "main")],
    });
    expect(mockEmbedNewChunks).toHaveBeenCalledWith("proj");
  });

  it("keeps ingested chunks when embedding fails", async () => {
    mockEmbedNewChunks.mockRejectedValue(
      new Error("401 Missing Authentication header"),
    );
    const source = makeSource([commit("a")]);

    const result = await ingestCommits(source, call);

    expect(result).toEqual({ commitsFound: 1, chunksWritten: 1, tipSha: "tip123" });
    expect(mockUpsertCommitChunks).toHaveBeenCalled();
    expect(mockEmbedNewChunks).toHaveBeenCalledWith("proj");
  });

  it("dedupes against stored chunks before enriching them", async () => {
    mockGetChunksByShas.mockResolvedValue(new Map([["a", {} as never]]));
    const source = makeSource([commit("a")]);

    const result = await ingestCommits(source, call);

    expect(result).toEqual({ commitsFound: 1, chunksWritten: 0, tipSha: "tip123" });
    expect(source.toChunkInputs).not.toHaveBeenCalled();
    expect(mockUpsertCommitChunks).not.toHaveBeenCalled();
  });

  it("batches enrichment and upsert by source.batchSize", async () => {
    const source = makeSource([commit("a"), commit("b"), commit("c")], { batchSize: 2 });

    await ingestCommits(source, call);

    expect(source.toChunkInputs).toHaveBeenCalledTimes(2);
    expect(mockUpsertCommitChunks).toHaveBeenCalledTimes(2);
    const sizes = mockUpsertCommitChunks.mock.calls.map((c) => c[0].inputs.length);
    expect(sizes).toEqual([2, 1]);
  });

  it("re-checks pending embeddings when the source writes nothing", async () => {
    const source = makeSource([commit("a")], { skippedShas: ["a"] });

    const result = await ingestCommits(source, call);

    expect(result).toEqual({ commitsFound: 1, chunksWritten: 0, tipSha: "tip123" });
    expect(mockUpsertCommitChunks).not.toHaveBeenCalled();
    // Chunks may exist from an earlier run where the provider was unavailable.
    expect(mockEmbedNewChunks).toHaveBeenCalledWith("proj");
  });

  it("reports commitsFound from the full list, not just new commits", async () => {
    mockGetChunksByShas.mockResolvedValue(new Map([["a", {} as never]]));
    const source = makeSource([commit("a"), commit("b")]);

    const result = await ingestCommits(source, call);

    expect(result.commitsFound).toBe(2);
    expect(result.chunksWritten).toBe(1);
  });

  it("emits commits → ingest → embedding progress stages in order", async () => {
    const stages: string[] = [];
    const source = makeSource([commit("a")], { batchSize: 1 });

    await ingestCommits(source, { ...call, onProgress: (stage) => stages.push(stage) });

    expect(stages).toEqual(["commits", "ingest", "embedding"]);
  });
});
