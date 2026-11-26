import { describe, expect, it, vi } from "vitest";
import { createGithubApiClient } from "@/rag/github/github-api";

function rawCommit(opts: {
  sha: string;
  message: string;
  date: string;
  author?: string;
  url?: string;
}) {
  return {
    sha: opts.sha,
    html_url: opts.url,
    commit: {
      message: opts.message,
      author: { name: opts.author ?? "dev", email: "dev@example.com", date: opts.date },
    },
  };
}

function makeClient(request: ReturnType<typeof vi.fn>, token: string | null = "token") {
  return createGithubApiClient({ octokit: { request } as never, token });
}

describe("createGithubApiClient", () => {
  it("lists commits newest-first with the pagination params", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          rawCommit({ sha: "a", message: "first", date: "2026-01-02T00:00:00Z" }),
        ],
      })
      .mockResolvedValueOnce({ data: [] });
    const client = makeClient(request);

    const commits = await client.listCommits({
      owner: "o",
      repo: "r",
      branch: "main",
    });

    expect(request).toHaveBeenCalledWith("GET /repos/{owner}/{repo}/commits", {
      owner: "o",
      repo: "r",
      sha: "main",
      per_page: 100,
      page: 1,
    });
    expect(commits).toEqual([
      {
        sha: "a",
        message: "first",
        author: "dev",
        date: "2026-01-02T00:00:00.000Z",
        url: "https://github.com/o/r/commit/a",
      },
    ]);
  });

  it("applies the date window and max", async () => {
    const request = vi.fn().mockResolvedValue({
      data: [
        rawCommit({ sha: "a", message: "new", date: "2026-02-01T00:00:00Z" }),
        rawCommit({ sha: "b", message: "old", date: "2026-01-01T00:00:00Z" }),
      ],
    });
    const client = makeClient(request);

    const commits = await client.listCommits({
      owner: "o",
      repo: "r",
      branch: "main",
      since: new Date("2026-01-15T00:00:00Z"),
      max: 10,
    });

    expect(commits.map((c) => c.sha)).toEqual(["a"]);
  });

  it("fetches best-effort file scopes when a token is present", async () => {
    const request = vi.fn(async (_route: string, params: { ref: string }) => ({
      data: { files: [{ filename: `${params.ref}.txt`, status: "modified" }] },
    }));
    const client = makeClient(request, "token");

    const map = await client.getChangedFilesForShas({
      owner: "o",
      repo: "r",
      shas: ["a", "b"],
    });

    expect(map.get("a")).toEqual([
      {
        filepath: "a.txt",
        status: "modified",
        additions: 0,
        deletions: 0,
        patch: undefined,
        binary: true,
      },
    ]);
    expect(map.get("b")).toEqual([
      {
        filepath: "b.txt",
        status: "modified",
        additions: 0,
        deletions: 0,
        patch: undefined,
        binary: true,
      },
    ]);
  });

  it("fetches file scopes anonymously when no token is present", async () => {
    const request = vi.fn(async () => ({
      data: { files: [{ filename: "a.txt", status: "modified" }] },
    }));
    const client = makeClient(request, null);

    const map = await client.getChangedFilesForShas({
      owner: "o",
      repo: "r",
      shas: ["a"],
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(map.get("a")).toEqual([
      {
        filepath: "a.txt",
        status: "modified",
        additions: 0,
        deletions: 0,
        patch: undefined,
        binary: true,
      },
    ]);
  });

  it("swallows individual file-scope failures", async () => {
    const request = vi.fn(async (_route: string, params: { ref: string }) => {
      if (params.ref === "a") throw new Error("rate limited");
      return { data: { files: [{ filename: "b.txt", status: "added" }] } };
    });
    const client = makeClient(request, "token");

    const map = await client.getChangedFilesForShas({
      owner: "o",
      repo: "r",
      shas: ["a", "b"],
    });

    expect(map.has("a")).toBe(false);
    expect(map.get("b")).toEqual([
      {
        filepath: "b.txt",
        status: "added",
        additions: 0,
        deletions: 0,
        patch: undefined,
        binary: true,
      },
    ]);
  });
});
