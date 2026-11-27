import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetByKey = vi.fn();
const mockUpsert = vi.fn();
const mockResolveSpace = vi.fn();
const mockEmbed = vi.fn();

vi.mock("@/rag/indexing/commit-embeddings-store", () => ({
  commitEmbeddingsStore: {
    getByKey: (...args: unknown[]) => mockGetByKey(...args),
    upsertCommit: (...args: unknown[]) => mockUpsert(...args),
  },
}));

vi.mock("@/rag/indexing/embeddings", () => ({
  resolveEmbeddingSpace: (...args: unknown[]) => mockResolveSpace(...args),
  embedTextsWithUsage: (...args: unknown[]) => mockEmbed(...args),
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

const space = { provider: "openrouter", model: "openai/text-embedding-3-small" };
const call = {
  gitProvider: "github" as const,
  owner: "owner",
  repo: "repo",
  branch: "main",
  projectId: "project-1",
};

const contentHash = contentHashOf(
  commitEmbeddingText(diff.filesChanged, commit.message),
);

function source(overrides: Partial<CommitSource> = {}): CommitSource {
  return {
    listCommits: vi.fn(async () => ({ commits: [commit], tipSha: "tip" })),
    readDiff: vi.fn(async () => diff),
    ...overrides,
  };
}

beforeEach(() => {
  mockGetByKey.mockReset().mockResolvedValue(null);
  mockUpsert.mockReset().mockResolvedValue(undefined);
  mockResolveSpace.mockReset().mockResolvedValue(space);
  mockEmbed.mockReset().mockResolvedValue({
    embeddings: [[0.1, 0.2]],
    usage: { ...space, inputTokens: 12, outputTokens: 0 },
  });
});

describe("ingestCommits", () => {
  it("stores the commit with message-based embeddings and no summary", async () => {
    const result = await ingestCommits(source(), call);

    expect(mockUpsert).toHaveBeenCalledWith({
      repoId: "project-1",
      branch: "main",
      commitSha: "abc123",
      author: "dev",
      committedAt: new Date("2026-01-01T00:00:00Z"),
      message: "feat: lol",
      commitUrl: "https://github.com/owner/repo/commit/abc123",
      filesChanged: ["src/auth/session.ts"],
      diffHash: "diff-hash",
      contentHash,
      embedding: { vector: [0.1, 0.2], ...space },
    });
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty("summary");
    expect(result).toEqual({
      commitsFound: 1,
      chunksWritten: 1,
      summarized: 0,
      embedded: 1,
      gitMs: expect.any(Number),
      dbMs: expect.any(Number),
      embeddingMs: expect.any(Number),
      embeddingProvider: "openrouter",
      embeddingModel: "openai/text-embedding-3-small",
      embeddingInputTokens: 12,
      embeddingOutputTokens: 0,
      tipSha: "tip",
    });
    expect(result.embeddingMs).toBeGreaterThanOrEqual(0);
  });

  it("skips embedding when the stored vector is current", async () => {
    mockGetByKey.mockResolvedValue({
      embeddingHash: contentHash,
      embeddingProvider: space.provider,
      embeddingModel: space.model,
    });

    const result = await ingestCommits(source(), call);

    expect(mockEmbed).not.toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty("embedding");
    expect(result.embedded).toBe(1);
    expect(result.embeddingMs).toBe(0);
    expect(result.embeddingProvider).toBe("openrouter");
    expect(result.embeddingModel).toBe("openai/text-embedding-3-small");
    expect(result.embeddingInputTokens).toBe(0);
    expect(result.embeddingOutputTokens).toBe(0);
  });

  it("skips commits with no summarizable diff", async () => {
    const result = await ingestCommits(
      source({ readDiff: vi.fn(async () => null) }),
      call,
    );

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(result.chunksWritten).toBe(0);
    expect(result.embeddingMs).toBe(0);
  });

  it("keeps the commit when embedding fails", async () => {
    mockEmbed.mockRejectedValue(new Error("provider down"));

    const result = await ingestCommits(source(), call);

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.not.objectContaining({ embedding: expect.anything() }),
    );
    expect(result.summarized).toBe(0);
    expect(result.embedded).toBe(0);
  });

  it("stores null tokens when a provider omits usage", async () => {
    mockEmbed.mockResolvedValue({
      embeddings: [[0.1, 0.2]],
      usage: { ...space, inputTokens: null, outputTokens: null },
    });

    const result = await ingestCommits(source(), call);

    expect(result.embedded).toBe(1);
    expect(result.embeddingInputTokens).toBeNull();
    expect(result.embeddingOutputTokens).toBeNull();
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
