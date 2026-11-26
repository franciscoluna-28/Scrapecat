import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createGitRepositoryService } from "@/rag/git/git-repository-service";

const COMMIT = {
  sha: "a",
  message: "fix: parser",
  author: "t",
  date: "2026-01-01T00:00:00Z",
  tree: "t1",
  parentSha: null,
};

const PATCH = [
  "diff --git a/src/a.ts b/src/a.ts",
  "--- a/src/a.ts",
  "+++ b/src/a.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
].join("\n");

let workspaceRoot: string;
let lsRemote: string;
let numstat: string;
let cloneDir: string | null;
let failClone: boolean;

const runGit = vi.fn(async (opts: { args: string[] }) => {
  const { args } = opts;
  if (args.includes("clone")) {
    cloneDir = args[args.length - 1];
    await fs.mkdir(path.join(cloneDir, ".git"), { recursive: true });
    if (failClone) throw new Error("clone failed");
    return "";
  }
  if (args.includes("ls-remote")) return lsRemote;
  if (args.includes("rev-parse")) return "tip-from-git";
  if (args.includes("--numstat")) return numstat;
  if (args.includes("--patch")) return PATCH;
  return "";
});

const listCommitsInRange = vi.fn(async () => [COMMIT]);

function service() {
  return createGitRepositoryService({
    runGit,
    listCommitsInRange,
    cloneUrl: (_provider, owner, repo) => `https://github.com/${owner}/${repo}.git`,
    commitUrl: (_provider, owner, repo, sha) =>
      `https://github.com/${owner}/${repo}/commit/${sha}`,
    authEnv: () => undefined,
    resolveGitToken: async () => null,
    workspaceRoot,
  });
}

const REF = {
  gitProvider: "github" as const,
  owner: "owner",
  repo: "repo",
  branch: "main",
};

beforeEach(async () => {
  workspaceRoot = path.join(os.tmpdir(), `scrapecat-test-${randomUUID()}`);
  lsRemote = "abc123\trefs/heads/main\n";
  numstat = "10\t5\tsrc/a.ts\n";
  cloneDir = null;
  failClone = false;
  runGit.mockClear();
  listCommitsInRange.mockClear().mockResolvedValue([COMMIT]);
});

afterEach(async () => {
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

describe("git repository service", () => {
  it("resolves the remote tip without cloning", async () => {
    await expect(service().tip(REF)).resolves.toBe("abc123");
    expect(runGit.mock.calls.some(([opts]) => opts.args.includes("clone"))).toBe(
      false,
    );
  });

  it("reports a missing branch as BranchNotFound", async () => {
    lsRemote = "";
    await expect(service().tip(REF)).rejects.toMatchObject({
      code: "BranchNotFound",
    });
  });

  it("opens a blobless workspace and reads a capped diff", async () => {
    const handle = await service().open(REF);

    expect(handle.tipSha).toBe("tip-from-git");
    const clone = runGit.mock.calls.find(([opts]) => opts.args.includes("clone"))?.[0];
    expect(clone?.args).toEqual(
      expect.arrayContaining([
        "clone",
        "--single-branch",
        "--branch",
        "main",
        "--no-checkout",
        "--filter=blob:none",
      ]),
    );

    const diff = await handle.diff({ sha: "a", parentSha: null });
    expect(diff).toMatchObject({
      filesChanged: ["src/a.ts"],
      additions: 10,
      deletions: 5,
      binaryFiles: 0,
    });
    expect(diff?.stat).toContain("src/a.ts | +10 -5");
    expect(diff?.patch).toContain("+new");
    expect(diff?.hash).toHaveLength(64);
  });

  it("returns null when there are no changed files", async () => {
    numstat = "";
    const handle = await service().open(REF);

    await expect(handle.diff({ sha: "a", parentSha: null })).resolves.toBeNull();
  });

  it("removes the workspace on dispose and sweeps stale dirs", async () => {
    const handle = await service().open(REF);
    await handle.dispose();
    await handle.dispose();
    await expect(fs.access(handle.dir)).rejects.toBeTruthy();

    const stale = path.join(workspaceRoot, "stale");
    await fs.mkdir(stale, { recursive: true });
    await service().sweep();
    await expect(fs.access(stale)).rejects.toBeTruthy();
  });

  it("removes a partial clone when cloning fails", async () => {
    failClone = true;

    await expect(service().open(REF)).rejects.toThrow("clone failed");
    if (cloneDir) {
      await expect(fs.access(cloneDir)).rejects.toBeTruthy();
    }
  });
});
