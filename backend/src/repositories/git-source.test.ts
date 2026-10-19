import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnsureArchive = vi.fn();
const mockListCommitsInRange = vi.fn();
const mockGetCommitChangedFiles = vi.fn();

vi.mock("@/repositories/archive-service", () => ({
  ensureArchive: (...args: unknown[]) => mockEnsureArchive(...args),
}));

vi.mock("@/repositories/git-reader", () => ({
  listCommitsInRange: (...args: unknown[]) => mockListCommitsInRange(...args),
}));

vi.mock("@/repositories/git-diff", () => ({
  getCommitChangedFiles: (...args: unknown[]) => mockGetCommitChangedFiles(...args),
}));

import { createGitCommitSource } from "@/repositories/git-source";
import type { CommitChangedStats } from "@/repositories/git-diff";

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
  mockGetCommitChangedFiles.mockReset().mockResolvedValue(DIFF);
});

describe("createGitCommitSource", () => {
  it("ensures the archive and returns commits with the archive tip", async () => {
    const source = createGitCommitSource({ owner: "owner", repo: "repo", branch: "main" });

    const { commits, tipSha } = await source.listCommits({});

    expect(mockEnsureArchive).toHaveBeenCalledWith({
      owner: "owner",
      repo: "repo",
      branch: "main",
      jobId: undefined,
    });
    expect(commits).toEqual([commit]);
    expect(tipSha).toBe("tip123");
  });

  it("builds chunk inputs with file scope, github url, and validation", async () => {
    const source = createGitCommitSource({ owner: "owner", repo: "repo", branch: "main" });
    await source.listCommits({});

    const { inputs, skipped } = await source.toChunkInputs([commit], CTX);

    expect(skipped).toBe(0);
    expect(mockGetCommitChangedFiles).toHaveBeenCalledWith({
      dir: "/repo",
      parentSha: null,
      commitSha: "a",
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
    const source = createGitCommitSource({ owner: "owner", repo: "repo", branch: "main" });
    await source.listCommits({});

    const { inputs } = await source.toChunkInputs([{ ...commit, message: "fix: lol" }], CTX);

    expect(inputs[0].metadata?.validation?.status).toBe("flagged");
    expect(inputs[0].metadata?.validation?.notes?.length ?? 0).toBeGreaterThan(0);
  });

  it("skips empty commits and counts them", async () => {
    mockGetCommitChangedFiles.mockResolvedValue({ filesChanged: 0, files: [] });
    const source = createGitCommitSource({ owner: "owner", repo: "repo", branch: "main" });
    await source.listCommits({});

    const { inputs, skipped } = await source.toChunkInputs([commit], CTX);

    expect(inputs).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("passes the first parent to the diff for non-root commits", async () => {
    const source = createGitCommitSource({ owner: "owner", repo: "repo", branch: "main" });
    await source.listCommits({});

    await source.toChunkInputs([{ ...commit, parentSha: "p0" }], CTX);

    expect(mockGetCommitChangedFiles).toHaveBeenCalledWith({
      dir: "/repo",
      parentSha: "p0",
      commitSha: "a",
    });
  });
});
