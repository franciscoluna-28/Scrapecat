import { describe, it, expect } from "vitest";
import { parseRepoUrl } from "./repo-url";

describe("parseRepoUrl", () => {
  it.each([
    [
      "https://github.com/owner/repo",
      { owner: "owner", repo: "repo", provider: "github" },
    ],
    ["github.com/owner/repo", { owner: "owner", repo: "repo", provider: "github" }],
    ["owner/repo", { owner: "owner", repo: "repo" }],
    [
      "https://github.com/owner/repo.git",
      { owner: "owner", repo: "repo", provider: "github" },
    ],
    [
      "https://github.com/owner/repo/tree/main",
      { owner: "owner", repo: "repo", provider: "github" },
    ],
    ["https://github.com/owner/repo/", { owner: "owner", repo: "repo", provider: "github" }],
    ["  owner/repo  ", { owner: "owner", repo: "repo" }],
    [
      "https://gitlab.com/group/repo",
      { owner: "group", repo: "repo", provider: "gitlab" },
    ],
    [
      "https://gitlab.com/group/subgroup/repo/-/tree/main",
      { owner: "group/subgroup", repo: "repo", provider: "gitlab" },
    ],
    [
      "https://gitlab.example.com/group/subgroup/repo.git",
      { owner: "group/subgroup", repo: "repo", provider: "gitlab" },
    ],
    [
      "gitlab.com/group/repo/-/blob/main/README.md",
      { owner: "group", repo: "repo", provider: "gitlab" },
    ],
    // Self-hosted GitLab on a custom domain can't be inferred from the host.
    [
      "https://git.example.com/group/repo",
      { owner: "group", repo: "repo" },
    ],
  ])("parses %s", (input, expected) => {
    expect(parseRepoUrl(input)).toEqual(expected);
  });

  it.each([
    [""],
    ["   "],
    ["not a url"],
    ["github.com/onlyowner"],
    ["https://github.com/"],
  ])("returns null for %s", (input) => {
    expect(parseRepoUrl(input)).toBeNull();
  });
});
