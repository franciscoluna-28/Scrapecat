import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListCommitsFromApi = vi.fn();
const mockGetChangedFilesForShas = vi.fn();

vi.mock("@/repositories/github-api", () => ({
  listCommitsFromApi: (...args: unknown[]) => mockListCommitsFromApi(...args),
  getChangedFilesForShas: (...args: unknown[]) => mockGetChangedFilesForShas(...args),
}));

import { createApiCommitSource } from "@/repositories/api-source";

const CTX = { owner: "o", repo: "r", branch: "main", projectId: "proj" };

const apiCommit = {
  sha: "a",
  message: "m",
  author: "t",
  date: "2026-01-01T00:00:00Z",
  url: "https://github.com/o/r/commit/a",
};

beforeEach(() => {
  mockListCommitsFromApi.mockReset().mockResolvedValue([apiCommit]);
  mockGetChangedFilesForShas.mockReset().mockResolvedValue(new Map());
});

describe("createApiCommitSource", () => {
  it("lists commits via the API and uses the first commit as the tip", async () => {
    const source = createApiCommitSource({ owner: "o", repo: "r", branch: "main" });

    const { commits, tipSha } = await source.listCommits({});

    expect(commits).toEqual([apiCommit]);
    expect(tipSha).toBe("a");
  });

  it("returns an empty tip when there are no commits", async () => {
    mockListCommitsFromApi.mockResolvedValue([]);
    const source = createApiCommitSource({ owner: "o", repo: "r", branch: "main" });

    const { commits, tipSha } = await source.listCommits({});

    expect(commits).toEqual([]);
    expect(tipSha).toBe("");
  });

  it("builds inputs from file scopes with the provider url and no validation", async () => {
    mockGetChangedFilesForShas.mockResolvedValue(
      new Map([["a", [{ filepath: "a.txt", status: "modified" }]]]),
    );
    const source = createApiCommitSource({ owner: "o", repo: "r", branch: "main" });
    await source.listCommits({});

    const { inputs, skipped } = await source.toChunkInputs([apiCommit], CTX);

    expect(skipped).toBe(0);
    expect(mockGetChangedFilesForShas).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      shas: ["a"],
    });
    expect(inputs).toEqual([
      {
        projectId: "proj",
        commitSha: "a",
        branch: "main",
        commitMessage: "m",
        author: "t",
        metadata: {
          filesChanged: ["a.txt"],
          commitUrl: "https://github.com/o/r/commit/a",
        },
        committedAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    expect(inputs[0].metadata).not.toHaveProperty("validation");
  });

  it("defaults filesChanged to [] when the file fetch misses a sha", async () => {
    const source = createApiCommitSource({ owner: "o", repo: "r", branch: "main" });
    await source.listCommits({});

    const { inputs } = await source.toChunkInputs([apiCommit], CTX);

    expect(inputs[0].metadata?.filesChanged).toEqual([]);
  });

  it("uses a single batch", () => {
    const source = createApiCommitSource({ owner: "o", repo: "r", branch: "main" });
    expect(source.batchSize).toBe(Infinity);
  });
});
