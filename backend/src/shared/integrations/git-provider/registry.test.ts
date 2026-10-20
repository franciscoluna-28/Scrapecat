import { describe, it, expect } from "vitest";
import { getGitProviderConfig } from "@/shared/integrations/git-provider/registry";
import { commitUrl, cloneUrl } from "@/shared/integrations/git-provider/urls";
import { authArgs } from "@/repositories/git";

describe("git provider registry", () => {
  it("builds provider-aware commit and clone urls", () => {
    expect(commitUrl("github", "owner", "repo", "abc123")).toBe(
      "https://github.com/owner/repo/commit/abc123",
    );
    expect(cloneUrl("github", "owner", "repo")).toBe(
      "https://github.com/owner/repo.git",
    );
  });

  it("returns the configured provider's implementation", () => {
    expect(getGitProviderConfig("github").id).toBe("github");
  });

  it("fails fast for a provider with no implementation", () => {
    expect(() => getGitProviderConfig("gitlab")).toThrow(/not implemented/);
  });

  it("uses provider-aware clone auth", () => {
    const [, header] = authArgs("github", "tok");
    expect(header.startsWith("http.extraheader=AUTHORIZATION: basic ")).toBe(true);
    const encoded = header.replace("http.extraheader=AUTHORIZATION: basic ", "");
    expect(Buffer.from(encoded, "base64").toString()).toBe("x-access-token:tok");
  });

  it("omits auth headers when there is no token", () => {
    expect(authArgs("github", null)).toEqual([]);
  });
});