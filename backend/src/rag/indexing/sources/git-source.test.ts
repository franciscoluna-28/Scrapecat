import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOpen = vi.fn();

vi.mock("@/rag/git/git-repository-service", () => ({
  gitRepositoryService: {
    open: (...args: unknown[]) => mockOpen(...args),
  },
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

type FakeHandle = {
  dir: string;
  tipSha: string;
  listCommits: ReturnType<typeof vi.fn>;
  changedFiles: ReturnType<typeof vi.fn>;
  commitUrl: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};

let handle: FakeHandle;

beforeEach(() => {
  handle = {
    dir: "/repo",
    tipSha: "tip123",
    listCommits: vi.fn().mockResolvedValue([commit]),
    changedFiles: vi.fn().mockResolvedValue(new Map([["a", DIFF]])),
    commitUrl: vi.fn(
      (sha: string) => `https://github.com/owner/repo/commit/${sha}`,
    ),
    dispose: vi.fn().mockResolvedValue(undefined),
  };
  mockOpen.mockReset().mockResolvedValue(handle);
});

function source() {
  return createGitCommitSource({
    gitProvider: "github",
    owner: "owner",
    repo: "repo",
    branch: "main",
  });
}

describe("createGitCommitSource", () => {
  it("opens the repository service and returns commits with its tip", async () => {
    const { commits, tipSha } = await source().listCommits({});

    expect(mockOpen).toHaveBeenCalledWith({
      gitProvider: "github",
      owner: "owner",
      repo: "repo",
      branch: "main",
    });
    expect(handle.listCommits).toHaveBeenCalledWith({
      since: undefined,
      until: undefined,
    });
    expect(commits).toEqual([commit]);
    expect(tipSha).toBe("tip123");
  });

  it("builds chunk inputs with file scope, github url, and validation", async () => {
    const gitSource = source();
    await gitSource.listCommits({});

    const { inputs, skipped } = await gitSource.toChunkInputs([commit], CTX);

    expect(skipped).toBe(0);
    expect(handle.changedFiles).toHaveBeenCalledWith(["a"]);
    expect(handle.commitUrl).toHaveBeenCalledWith("a");
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
    const gitSource = source();
    await gitSource.listCommits({});

    const { inputs } = await gitSource.toChunkInputs(
      [{ ...commit, message: "fix: lol" }],
      CTX,
    );

    expect(inputs[0].metadata?.validation?.status).toBe("flagged");
    expect(inputs[0].metadata?.validation?.notes?.length ?? 0).toBeGreaterThan(0);
  });

  it("skips empty commits and counts them", async () => {
    handle.changedFiles.mockResolvedValue(
      new Map([["a", { filesChanged: 0, files: [] }]]),
    );
    const gitSource = source();
    await gitSource.listCommits({});

    const { inputs, skipped } = await gitSource.toChunkInputs([commit], CTX);

    expect(inputs).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("skips commits missing from the batched diff result", async () => {
    handle.changedFiles.mockResolvedValue(new Map());
    const gitSource = source();
    await gitSource.listCommits({});

    const { inputs, skipped } = await gitSource.toChunkInputs([commit], CTX);

    expect(inputs).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("disposes the repository handle once", async () => {
    const gitSource = source();
    await gitSource.listCommits({});

    await gitSource.dispose?.();
    await gitSource.dispose?.();

    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });
});
