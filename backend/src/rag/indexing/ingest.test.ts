import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetByKey = vi.fn();
const mockFindReusable = vi.fn();
const mockUpsert = vi.fn();
const mockResolveModel = vi.fn();
const mockSummarize = vi.fn();
const mockResolveSpace = vi.fn();
const mockEmbed = vi.fn();

vi.mock("@/rag/indexing/commit-embeddings-store", () => ({
  commitEmbeddingsStore: {
    getByKey: (...args: unknown[]) => mockGetByKey(...args),
    findReusableSummary: (...args: unknown[]) => mockFindReusable(...args),
    upsertCommit: (...args: unknown[]) => mockUpsert(...args),
  },
}));

vi.mock("@/rag/indexing/commit-summary-service", () => ({
  commitSummaryService: {
    resolveModel: (...args: unknown[]) => mockResolveModel(...args),
    summarize: (...args: unknown[]) => mockSummarize(...args),
  },
  COMMIT_SUMMARY_VERSION: "v1",
  fallbackCommitSummary: () => "structural fallback",
}));

vi.mock("@/rag/indexing/embeddings", () => ({
  resolveEmbeddingSpace: (...args: unknown[]) => mockResolveSpace(...args),
  embedTexts: (...args: unknown[]) => mockEmbed(...args),
}));

import { ingestCommits } from "@/rag/indexing/ingest";
import type { CommitSource, SourceCommit } from "@/rag/indexing/source";
import type { CommitDiff } from "@/rag/git/commit-diff";
import { commitEmbeddingText, contentHashOf } from "@/shared/utils";

const commit: SourceCommit = {
  sha: "abc123",
  message: "feat: lol",
  author: "dev",
  date: "2026-01-01T00:00:00Z",
  parentSha: null,
  url: "https://github.com/owner/repo/commit/abc123",
};

const diff: CommitDiff = {
  stat: "src/auth/session.ts | +10 -5",
  patch: "diff --git a/src/auth/session.ts b/src/auth/session.ts\n@@ -1 +1 @@\n-old\n+new",
  filesChanged: ["src/auth/session.ts"],
  additions: 10,
  deletions: 5,
  binaryFiles: 0,
  truncated: false,
  hash: "diff-hash",
};

const model = { provider: "openrouter", model: { id: "test/summarizer" } } as never;
const space = { provider: "openrouter", model: "openai/text-embedding-3-small" };
const call = {
  gitProvider: "github" as const,
  owner: "owner",
  repo: "repo",
  branch: "main",
  projectId: "project-1",
};

function source(overrides: Partial<CommitSource> = {}): CommitSource {
  return {
    listCommits: vi.fn(async () => ({ commits: [commit], tipSha: "tip" })),
    readDiff: vi.fn(async () => diff),
    ...overrides,
  };
}

beforeEach(() => {
  mockGetByKey.mockReset().mockResolvedValue(null);
  mockFindReusable.mockReset().mockResolvedValue(null);
  mockUpsert.mockReset().mockResolvedValue(undefined);
  mockResolveModel.mockReset().mockResolvedValue(model);
  mockSummarize
    .mockReset()
    .mockResolvedValue({ summary: "Centralizes auth validation.", model: "test/summarizer" });
  mockResolveSpace.mockReset().mockResolvedValue(space);
  mockEmbed.mockReset().mockResolvedValue([[0.1, 0.2]]);
});

describe("ingestCommits", () => {
  it("summarizes, embeds, and stores a new commit", async () => {
    const result = await ingestCommits(source(), call);

    expect(mockSummarize).toHaveBeenCalledOnce();
    const summary = "Centralizes auth validation.";
    const contentHash = contentHashOf(
      commitEmbeddingText(diff.filesChanged, summary),
    );
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        repoId: "project-1",
        branch: "main",
        commitSha: "abc123",
        message: "feat: lol",
        summary,
        summaryVersion: "v1",
        summaryModel: "test/summarizer",
        diffHash: "diff-hash",
        filesChanged: ["src/auth/session.ts"],
        contentHash,
        embedding: { vector: [0.1, 0.2], ...space },
      }),
    );
    expect(result).toEqual({
      commitsFound: 1,
      chunksWritten: 1,
      summarized: 1,
      embedded: 1,
      tipSha: "tip",
    });
  });

  it("reuses a summary from another branch", async () => {
    mockFindReusable.mockResolvedValue({
      summary: "Reused auth summary.",
      summaryModel: "test/summarizer",
      embedding: null,
      embeddingHash: null,
      embeddingProvider: null,
      embeddingModel: null,
    });

    await ingestCommits(source(), call);

    expect(mockSummarize).not.toHaveBeenCalled();
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ summary: "Reused auth summary." }),
    );
  });

  it("skips summarization and embedding when the row is current", async () => {
    const summary = "Current summary.";
    const contentHash = contentHashOf(
      commitEmbeddingText(diff.filesChanged, summary),
    );
    mockGetByKey.mockResolvedValue({
      diffHash: "diff-hash",
      summaryVersion: "v1",
      summaryModel: "test/summarizer",
      summary,
      embeddingHash: contentHash,
      embeddingProvider: space.provider,
      embeddingModel: space.model,
    });

    const result = await ingestCommits(source(), call);

    expect(mockSummarize).not.toHaveBeenCalled();
    expect(mockEmbed).not.toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty("embedding");
    expect(result.embedded).toBe(1);
  });

  it("skips commits with no summarizable diff", async () => {
    const result = await ingestCommits(
      source({ readDiff: vi.fn(async () => null) }),
      call,
    );

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result.chunksWritten).toBe(0);
  });

  it("keeps the summary when embedding fails", async () => {
    mockEmbed.mockRejectedValue(new Error("provider down"));

    const result = await ingestCommits(source(), call);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ embedding: expect.anything() }),
    );
    expect(result.summarized).toBe(1);
    expect(result.embedded).toBe(0);
  });

  it("stops embedding after a fatal provider error", async () => {
    const second = { ...commit, sha: "def456" };
    const src = source({
      listCommits: vi.fn(async () => ({
        commits: [commit, second],
        tipSha: "tip",
      })),
    });
    mockEmbed.mockRejectedValue(
      Object.assign(new Error("Key limit exceeded"), { status: 403 }),
    );

    const result = await ingestCommits(src, call);

    expect(mockEmbed).toHaveBeenCalledTimes(1);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(result.chunksWritten).toBe(2);
    expect(result.embedded).toBe(0);
  });
});
