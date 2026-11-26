import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { createGitRepositoryService } from "@/rag/git/git-repository-service";
import type { CommitChangedStats } from "@/rag/git/git-diff";

const COMMIT = {
  sha: "a",
  message: "fix: parser",
  author: "t",
  date: "2026-01-01T00:00:00Z",
  tree: "t1",
  parentSha: null,
};

const DIFF: CommitChangedStats = {
  filesChanged: 1,
  files: [{ filepath: "a.txt", status: "modified" }],
};

let workspaceRoot: string;
let lsRemote: string;
let cloneDir: string | null;
let failClone: boolean;

const runGit = vi.fn(async (opts: { args: string[]; cwd?: string }) => {
  const { args } = opts;
  if (args.includes("clone")) {
    cloneDir = args[args.length - 1];
    await fs.mkdir(path.join(cloneDir, ".git"), { recursive: true });
    if (failClone) throw new Error("clone failed");
    return "";
  }
  if (args.includes("ls-remote")) return lsRemote;
  if (args.includes("rev-parse")) return "tip-from-git";
  return "";
});

const listCommitsInRange = vi.fn(async () => [COMMIT]);
const getCommitsChangedFiles = vi.fn(
  async () => new Map([["a", DIFF]]),
);
const cloneUrl = vi.fn(
  (_provider: string, owner: string, repo: string) =>
    `https://github.com/${owner}/${repo}.git`,
);
const commitUrl = vi.fn(
  (_provider: string, owner: string, repo: string, sha: string) =>
    `https://github.com/${owner}/${repo}/commit/${sha}`,
);

function service() {
  return createGitRepositoryService({
    runGit,
    listCommitsInRange,
    getCommitsChangedFiles,
    cloneUrl,
    commitUrl,
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
  cloneDir = null;
  failClone = false;
  runGit.mockClear();
  listCommitsInRange.mockClear().mockResolvedValue([COMMIT]);
  getCommitsChangedFiles.mockClear().mockResolvedValue(new Map([["a", DIFF]]));
  cloneUrl.mockClear();
  commitUrl.mockClear();
});

afterEach(async () => {
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

describe("git repository service", () => {
  it("resolves the remote tip without cloning", async () => {
    await expect(service().tip(REF)).resolves.toBe("abc123");

    const call = runGit.mock.calls[0][0];
    expect(call.args).toEqual(
      expect.arrayContaining(["ls-remote", "--heads", "refs/heads/main"]),
    );
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

  it("opens a blobless workspace and exposes log/diff reads", async () => {
    const handle = await service().open(REF);

    expect(handle.tipSha).toBe("tip-from-git");
    await expect(fs.access(path.join(handle.dir, ".git"))).resolves.toBeUndefined();
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

    await expect(handle.listCommits({})).resolves.toEqual([COMMIT]);
    expect(listCommitsInRange).toHaveBeenCalledWith({
      dir: handle.dir,
      ref: "main",
      since: undefined,
      until: undefined,
    });

    await expect(handle.changedFiles(["a"])).resolves.toEqual(
      new Map([["a", DIFF]]),
    );
    expect(getCommitsChangedFiles).toHaveBeenCalledWith({
      dir: handle.dir,
      shas: ["a"],
    });
    expect(handle.commitUrl("a")).toBe(
      "https://github.com/owner/repo/commit/a",
    );
  });

  it("removes the workspace on dispose and is idempotent", async () => {
    const handle = await service().open(REF);

    await handle.dispose();
    await handle.dispose();

    await expect(fs.access(handle.dir)).rejects.toBeTruthy();
  });

  it("removes a partial clone when cloning fails", async () => {
    failClone = true;

    await expect(service().open(REF)).rejects.toThrow("clone failed");
    if (cloneDir) {
      await expect(fs.access(cloneDir)).rejects.toBeTruthy();
    }
  });

  it("sweeps stale workspaces", async () => {
    await fs.mkdir(workspaceRoot, { recursive: true });
    const first = path.join(workspaceRoot, "one");
    const second = path.join(workspaceRoot, "two");
    await fs.mkdir(first);
    await fs.mkdir(second);

    await service().sweep();

    await expect(fs.access(first)).rejects.toBeTruthy();
    await expect(fs.access(second)).rejects.toBeTruthy();
  });
});
