import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const mockRunGit = vi.fn(async (opts: { args: string[] }) => {
  const { args } = opts;
  if (args.includes("clone")) {
    const cloneDir = args[args.length - 1];
    await fs.mkdir(path.join(cloneDir, ".git"), { recursive: true });
    return "";
  }
  if (args.includes("rev-parse")) return "tip-from-git";
  return "";
});

vi.mock("@/rag/git/git", () => ({
  runGit: (opts: { args: string[] }) => mockRunGit(opts),
  authEnv: () => undefined,
}));

vi.mock("@/shared/integrations/git-provider/token", () => ({
  resolveGitToken: async () => null,
}));

import { ensureArchive } from "@/rag/git/archive-service";

const dirs: string[] = [];

beforeEach(() => {
  dirs.length = 0;
  mockRunGit.mockClear();
});

afterEach(async () => {
  await Promise.all(dirs.map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("archive-service", () => {
  it("clones the branch and returns the resolved tip", async () => {
    const owner = "o";
    const repo = `r-${randomUUID()}`;
    const branch = "main";
    const destDir = path.resolve(".tmp-repos", owner, repo, branch);
    dirs.push(path.resolve(".tmp-repos", owner, repo));

    const archive = await ensureArchive({ gitProvider: "github", owner, repo, branch });

    expect(archive).toMatchObject({ owner, repo, branch, dir: destDir });
    expect(archive.tipSha).toBe("tip-from-git");
    const cloneCalls = mockRunGit.mock.calls.filter(([o]) => o.args.includes("clone"));
    expect(cloneCalls).toHaveLength(1);
    await expect(fs.access(path.join(destDir, ".git"))).resolves.toBeUndefined();
  });

  it("fetches an existing archive instead of cloning", async () => {
    const owner = "o";
    const repo = `r-${randomUUID()}`;
    const branch = "main";
    const destDir = path.resolve(".tmp-repos", owner, repo, branch);
    dirs.push(path.resolve(".tmp-repos", owner, repo));
    await fs.mkdir(path.join(destDir, ".git"), { recursive: true });

    await ensureArchive({ gitProvider: "github", owner, repo, branch });

    const cloneCalls = mockRunGit.mock.calls.filter(([o]) => o.args.includes("clone"));
    const fetchCalls = mockRunGit.mock.calls.filter(([o]) => o.args.includes("fetch"));
    expect(cloneCalls).toHaveLength(0);
    expect(fetchCalls).toHaveLength(1);
  });

  it("rejects paths that escape the archive root", async () => {
    await expect(
      ensureArchive({
        gitProvider: "github",
        owner: "o",
        repo: "r",
        branch: "../../Windows",
      }),
    ).rejects.toThrow(/Invalid branch/);
    await expect(
      ensureArchive({
        gitProvider: "github",
        owner: "..",
        repo: "r",
        branch: "main",
      }),
    ).rejects.toThrow(/Invalid owner/);
    await expect(
      ensureArchive({
        gitProvider: "github",
        owner: "o",
        repo: "r",
        branch: "C:\\Windows",
      }),
    ).rejects.toThrow(/Invalid branch/);
    expect(mockRunGit).not.toHaveBeenCalled();
  });
});
