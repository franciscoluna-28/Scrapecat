import { describe, it, expect, vi } from "vitest";
import { buildCommitChunks } from "./chunks";
import type { GitProvider } from "./git-provider";
import type { Commit, CommitDetail, PullRequest } from "./git-provider";

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

function makeDetail(): CommitDetail {
  return {
    ...makeCommit(),
    stats: { additions: 120, deletions: 30, total: 150 },
    files: [
      { filename: "src/auth/jwt.go", additions: 60, deletions: 10, patch: "ignored patch" },
      { filename: "src/auth/oauth.go", additions: 60, deletions: 20, patch: "ignored patch" },
    ],
  };
}

function makePullRequest(): PullRequest {
  return {
    body: "Added OAuth2 provider support for Google and GitHub. Refactored JWT token generation.",
    number: 402,
    title: "feat: Support OAuth2 login",
    url: "https://github.com/org/repo/pull/402",
  };
}

function makeProvider(overrides: Partial<GitProvider> = {}): GitProvider {
  return {
    listRepositories: vi.fn(),
    listBranches: vi.fn(),
    listCommits: vi.fn(),
    getCommitDetails: vi.fn(async () => makeDetail()),
    countCommits: vi.fn(),
    getPullRequestForCommit: vi.fn(async () => makePullRequest()),
    verifyConnection: vi.fn(),
    ...overrides,
  } as unknown as GitProvider;
}

describe("buildCommitChunks", () => {
  it("builds the structured commit doc", async () => {
    const provider = makeProvider();
    const [chunk] = await buildCommitChunks(provider, "org", "repo", [makeCommit()]);

    expect(chunk.commitSha).toBe("a1b2c3d4");
    expect(chunk.commitMessage).toBe("feat: support OAuth2 login");
    expect(chunk.author).toBe("fran@company.com");
    expect(chunk.metadata).toEqual({
      commitUrl: "https://github.com/org/repo/commit/a1b2c3d4",
      prNumber: 402,
      prTitle: "feat: Support OAuth2 login",
      prUrl: "https://github.com/org/repo/pull/402",
      filesChanged: ["src/auth/jwt.go", "src/auth/oauth.go"],
      additions: 120,
      deletions: 30,
    });
    expect(chunk.diffSummary).toContain("feat: support OAuth2 login");
    expect(chunk.diffSummary).toContain("Added OAuth2 provider support");
    expect(chunk.committedAt).toEqual(new Date("2026-01-15T10:00:00Z"));
  });

  it("never stores patch content", async () => {
    const provider = makeProvider();
    const [chunk] = await buildCommitChunks(provider, "org", "repo", [makeCommit()]);
    expect(chunk.diffSummary).not.toContain("ignored patch");
    expect(JSON.stringify(chunk.metadata)).not.toContain("ignored patch");
  });

  it("degrades gracefully when PR and detail calls fail", async () => {
    const provider = makeProvider({
      getPullRequestForCommit: vi.fn(async () => null),
      getCommitDetails: vi.fn(async () => null),
    });
    const [chunk] = await buildCommitChunks(provider, "org", "repo", [makeCommit()]);

    expect(chunk.metadata).toEqual({
      commitUrl: "https://github.com/org/repo/commit/a1b2c3d4",
    });
    expect(chunk.diffSummary).toBe("feat: support OAuth2 login");
  });

  it("does not include the pr title twice when it equals the message", async () => {
    const provider = makeProvider({
      getPullRequestForCommit: vi.fn(async () => ({ ...makePullRequest(), title: "feat: support OAuth2 login" })),
    });
    const [chunk] = await buildCommitChunks(provider, "org", "repo", [makeCommit()]);
    const occurrences = chunk.diffSummary.split("feat: support OAuth2 login").length - 1;
    expect(occurrences).toBe(1);
  });
});
