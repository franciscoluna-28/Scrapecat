import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnsureArchive = vi.fn();
const mockListCommitsInRange = vi.fn();
const mockGetCommitsChangedFiles = vi.fn();

vi.mock("@/rag/git/archive-service", () => ({
  ensureArchive: (...args: unknown[]) => mockEnsureArchive(...args),
}));

vi.mock("@/rag/git/git-reader", () => ({
  listCommitsInRange: (...args: unknown[]) => mockListCommitsInRange(...args),
}));

vi.mock("@/rag/git/git-diff", () => ({
  getCommitsChangedFiles: (...args: unknown[]) => mockGetCommitsChangedFiles(...args),
}));

import { createGitCommitSource } from "@/rag/indexing/sources/git-source";
import type { CommitChangedStats } from "@/rag/git/git-diff";

const CTX = { owner: "owner", repo: "repo", branch: "main", projectId: "proj" };

const DIFF: CommitChangedStats = {
  filesChanged: 1,
  files: [{ filepath: "a.txt", status: "modified" }],
};

const commit = {
  sha: "a",
  message: "fix: bug in parser",
  author: "t",
  date: "2026-01-01T00:00:00Z",
  tree: "t1",
  parentSha: null,
};

beforeEach(() => {
  mockEnsureArchive.mockReset().mockResolvedValue({ dir: "/repo", tipSha: "tip123" });
  mockListCommitsInRange.mockReset().mockResolvedValue([commit]);
  mockGetCommitsChangedFiles.mockReset().mockResolvedValue(new Map([["a", DIFF]]));
});

describe("createGitCommitSource", () => {
  it("ensures the archive and returns commits with the archive tip", async () => {
    const source = createGitCommitSource({ gitProvider: "github", owner: "owner", repo: "repo", branch: "main" });

    const { commits, tipSha } = await source.listCommits({});

    expect(mockEnsureArchive).toHaveBeenCalledWith({
      gitProvider: "github",
      owner: "owner",
      repo: "repo",
      branch: "main",
      jobId: undefined,
    });
    expect(commits).toEqual([commit]);
    expect(tipSha).toBe("tip123");
  });

  it("builds chunk inputs with file scope, github url, and validation", async () => {
    const source = createGitCommitSource({ gitProvider: "github", owner: "owner", repo: "repo", branch: "main" });
    await source.listCommits({});

    const { inputs, skipped } = await source.toChunkInputs([commit], CTX);

    expect(skipped).toBe(0);
    expect(mockGetCommitsChangedFiles).toHaveBeenCalledWith({
      dir: "/repo",
      shas: ["a"],
    });
    expect(inputs).toEqual([
      {
        projectId: "proj",
        commitSha: "a",
        branch: "main",
        commitMessage: "fix: bug in parser",
        author: "t",
        metadata: {
          filesChanged: ["a.txt"],
          commitUrl: "https://github.com/owner/repo/commit/a",
          validation: { status: "confirmed", notes: [] },
        },
        committedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
  });

  it("flags uninformative messages but still stores the commit", async () => {
    const source = createGitCommitSource({ gitProvider: "github", owner: "owner", repo: "repo", branch: "main" });
    await source.listCommits({});

    const { inputs } = await source.toChunkInputs([{ ...commit, message: "fix: lol" }], CTX);

    expect(inputs[0].metadata?.validation?.status).toBe("flagged");
    expect(inputs[0].metadata?.validation?.notes?.length ?? 0).toBeGreaterThan(0);
  });

  it("skips empty commits and counts them", async () => {
    mockGetCommitsChangedFiles.mockResolvedValue(new Map([["a", { filesChanged: 0, files: [] }]]));
    const source = createGitCommitSource({ gitProvider: "github", owner: "owner", repo: "repo", branch: "main" });
    await source.listCommits({});

    const { inputs, skipped } = await source.toChunkInputs([commit], CTX);

    expect(inputs).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("skips commits missing from the batched diff result", async () => {
    mockGetCommitsChangedFiles.mockResolvedValue(new Map());
    const source = createGitCommitSource({ gitProvider: "github", owner: "owner", repo: "repo", branch: "main" });
    await source.listCommits({});

    const { inputs, skipped } = await source.toChunkInputs([commit], CTX);

    expect(inputs).toEqual([]);
    expect(skipped).toBe(1);
  });
});
