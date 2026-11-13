import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DEMO_MODE = "true";
});

import { createGithubApiClient } from "@/rag/github/github-api";

function makeClient(request: ReturnType<typeof vi.fn>) {
  return createGithubApiClient({ octokit: { request } as never, token: "token" });
}

describe("demo GitHub reads", () => {
  it("reads commits from a public repository", async () => {
    const request = vi.fn(async (route: string) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { private: false } };
      }
      return {
        data: [
          {
            sha: "a",
            html_url: "https://github.com/o/public-repo/commit/a",
            commit: {
              message: "feat: ship",
              author: { name: "dev", date: "2026-01-02T00:00:00Z" },
            },
          },
        ],
      };
    });

    const commits = await makeClient(request).listCommits({
      owner: "o",
      repo: "public-repo",
      branch: "main",
    });

    expect(commits.map((c) => c.sha)).toEqual(["a"]);
    expect(request).toHaveBeenCalledWith("GET /repos/{owner}/{repo}", {
      owner: "o",
      repo: "public-repo",
    });
  });

  it("refuses private repositories", async () => {
    const request = vi.fn(async (route: string) => {
      if (route === "GET /repos/{owner}/{repo}") {
        return { data: { private: true } };
      }
      return { data: [] };
    });

    await expect(
      makeClient(request).listCommits({
        owner: "o",
        repo: "private-repo",
        branch: "main",
      }),
    ).rejects.toThrow("not public");
  });
});
