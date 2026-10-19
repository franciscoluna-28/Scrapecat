import { describe, it, expect } from "vitest";
import { parseRepoUrl } from "./repo-url";

describe("parseRepoUrl", () => {
  it.each([
    ["https://github.com/owner/repo", { owner: "owner", repo: "repo" }],
    ["github.com/owner/repo", { owner: "owner", repo: "repo" }],
    ["owner/repo", { owner: "owner", repo: "repo" }],
    ["https://github.com/owner/repo.git", { owner: "owner", repo: "repo" }],
    ["https://github.com/owner/repo/tree/main", { owner: "owner", repo: "repo" }],
    ["https://github.com/owner/repo/", { owner: "owner", repo: "repo" }],
    ["  owner/repo  ", { owner: "owner", repo: "repo" }],
  ])("parses %s", (input, expected) => {
    expect(parseRepoUrl(input)).toEqual(expected);
  });

  it.each([[""], ["   "], ["not a url"], ["github.com/onlyowner"]])(
    "returns null for %s",
    (input) => {
      expect(parseRepoUrl(input)).toBeNull();
    },
  );
});
