import { describe, it, expect } from "vitest";
import { buildCommitChunks } from "@/projects/chunks";
import type { Commit } from "@/shared/integrations/git-provider";

function makeCommit(overrides: Partial<Commit> = {}): Commit {
  return {
    sha: "a1b2c3d4",
    message: "feat: support OAuth2 login",
    author: "fran@company.com",
    date: "2026-01-15T10:00:00Z",
    url: "https://github.com/org/repo/commit/a1b2c3d4",
    ...overrides,
  };
}

describe("buildCommitChunks", () => {
  it("builds a chunk per commit with just the commit metadata", () => {
    const [chunk] = buildCommitChunks([makeCommit()]);

    expect(chunk.commitSha).toBe("a1b2c3d4");
    expect(chunk.commitMessage).toBe("feat: support OAuth2 login");
    expect(chunk.author).toBe("fran@company.com");
    expect(chunk.diffSummary).toBe("feat: support OAuth2 login");
    expect(chunk.metadata).toEqual({
      commitUrl: "https://github.com/org/repo/commit/a1b2c3d4",
    });
    expect(chunk.committedAt).toEqual(new Date("2026-01-15T10:00:00Z"));
  });

  it("handles multiple commits", () => {
    const commits = [
      makeCommit({ sha: "aaa" }),
      makeCommit({ sha: "bbb", message: "fix: retry on rate limit" }),
    ];
    const chunks = buildCommitChunks(commits);
    expect(chunks.map((c) => c.commitSha)).toEqual(["aaa", "bbb"]);
    expect(chunks[1].diffSummary).toBe("fix: retry on rate limit");
  });

  it("is a pure function: never calls the provider or fetches extra data", () => {
    const chunks = buildCommitChunks([makeCommit({ url: undefined })]);
    expect(chunks[0].metadata).toEqual({ commitUrl: undefined });
  });
});
