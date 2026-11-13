import { describe, it, expect } from "vitest";
import {
  getGitProviderConfig,
  type GitProviderId,
} from "@/shared/integrations/git-provider/registry";
import { commitUrl, cloneUrl } from "@/shared/integrations/git-provider/urls";
import { authEnv } from "@/rag/git/git";

describe("git provider registry", () => {
  it("builds provider-aware commit and clone urls", () => {
    expect(commitUrl("github", "owner", "repo", "abc123")).toBe(
      "https://github.com/owner/repo/commit/abc123",
    );
    expect(cloneUrl("github", "owner", "repo")).toBe(
      "https://github.com/owner/repo.git",
    );
  });

  it("builds GitLab commit and clone urls", () => {
    expect(commitUrl("gitlab", "group/subgroup", "repo", "abc123")).toBe(
      "https://gitlab.com/group/subgroup/repo/-/commit/abc123",
    );
    expect(cloneUrl("gitlab", "group/subgroup", "repo")).toBe(
      "https://gitlab.com/group/subgroup/repo.git",
    );
  });

  it("returns the configured provider's implementation", () => {
    expect(getGitProviderConfig("github").id).toBe("github");
    expect(getGitProviderConfig("gitlab").id).toBe("gitlab");
  });

  it("fails fast for a provider with no implementation", () => {
    expect(() => getGitProviderConfig("bitbucket" as GitProviderId)).toThrow(
      /not implemented/,
    );
  });

  it("uses provider-aware clone auth via the environment", () => {
    const env = authEnv("github", "tok");
    expect(env?.GIT_CONFIG_KEY_0).toBe("http.extraheader");
    const header = env?.GIT_CONFIG_VALUE_0 ?? "";
    expect(header.startsWith("AUTHORIZATION: basic ")).toBe(true);
    const encoded = header.replace("AUTHORIZATION: basic ", "");
    expect(Buffer.from(encoded, "base64").toString()).toBe("x-access-token:tok");
  });

  it("authenticates GitLab clones as the oauth2 user", () => {
    const header = authEnv("gitlab", "glpat")?.GIT_CONFIG_VALUE_0 ?? "";
    const encoded = header.replace("AUTHORIZATION: basic ", "");
    expect(Buffer.from(encoded, "base64").toString()).toBe("oauth2:glpat");
  });

  it("omits auth headers when there is no token", () => {
    expect(authEnv("github", null)).toBeUndefined();
    expect(authEnv("gitlab", null)).toBeUndefined();
  });
});
