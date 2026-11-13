import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiCommitSource } from "@/rag/indexing/sources/api-source";
import type { GithubApiClient } from "@/rag/github/github-api";

const CTX = { owner: "o", repo: "r", branch: "main", projectId: "proj" };

const apiCommit = {
  sha: "a",
  message: "m",
  author: "t",
  date: "2026-01-01T00:00:00Z",
  url: "https://github.com/o/r/commit/a",
};

function makeApi() {
  return {
    listCommits: vi.fn(),
    getChangedFilesForShas: vi.fn(),
  };
}

function makeSource(api: ReturnType<typeof makeApi>) {
  return createApiCommitSource(
    { gitProvider: "github", owner: "o", repo: "r", branch: "main" },
    api as unknown as GithubApiClient,
  );
}

describe("createApiCommitSource", () => {
  let api: ReturnType<typeof makeApi>;

  beforeEach(() => {
    api = makeApi();
    api.listCommits.mockResolvedValue([apiCommit]);
    api.getChangedFilesForShas.mockResolvedValue(new Map());
  });

  it("lists commits via the client and uses the first commit as the tip", async () => {
    const source = makeSource(api);

    const { commits, tipSha } = await source.listCommits({});

    expect(api.listCommits).toHaveBeenCalledWith({
      owner: "o",
      repo: "r",
      branch: "main",
      since: undefined,
      until: undefined,
    });
    expect(commits).toEqual([apiCommit]);
    expect(tipSha).toBe("a");
  });

  it("returns an empty tip when there are no commits", async () => {
    api.listCommits.mockResolvedValue([]);
    const source = makeSource(api);

    const { commits, tipSha } = await source.listCommits({});

    expect(commits).toEqual([]);
    expect(tipSha).toBe("");
  });

  it("builds inputs from file scopes with the provider url and no validation", async () => {
    api.getChangedFilesForShas.mockResolvedValue(
      new Map([["a", [{ filepath: "a.txt", status: "modified" }]]]),
    );
    const source = makeSource(api);
    await source.listCommits({});

    const { inputs, skipped } = await source.toChunkInputs([apiCommit], CTX);

    expect(skipped).toBe(0);
    expect(api.getChangedFilesForShas).toHaveBeenCalledWith({
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
    const source = makeSource(api);
    await source.listCommits({});

    const { inputs } = await source.toChunkInputs([apiCommit], CTX);

    expect(inputs[0].metadata?.filesChanged).toEqual([]);
  });

  it("uses a single batch", () => {
    const source = makeSource(api);
    expect(source.batchSize).toBe(Infinity);
  });
});
