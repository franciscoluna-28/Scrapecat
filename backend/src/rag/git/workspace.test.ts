import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

let lsRemoteEmpty = false;

const mockRunGit = vi.fn(async (opts: { args: string[] }) => {
  const { args } = opts;
  if (args.includes("clone")) {
    const cloneDir = args[args.length - 1];
    await fs.mkdir(path.join(cloneDir, ".git"), { recursive: true });
    return "";
  }
  if (args.includes("rev-parse")) return "tip-from-git";
  if (args.includes("ls-remote")) {
    return lsRemoteEmpty ? "" : "abc123\trefs/heads/main\n";
  }
  return "";
});

vi.mock("@/rag/git/git", () => ({
  runGit: (opts: { args: string[] }) => mockRunGit(opts),
  authEnv: () => undefined,
}));

vi.mock("@/shared/integrations/git-provider/token", () => ({
  resolveGitToken: async () => null,
}));

import {
  createWorkspace,
  disposeWorkspace,
  remoteTipSha,
} from "@/rag/git/workspace";

const dirs: string[] = [];

beforeEach(() => {
  lsRemoteEmpty = false;
  mockRunGit.mockClear();
});

afterEach(async () => {
  await Promise.all(dirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
  dirs.length = 0;
});

describe("workspace", () => {
  it("clones a blobless, no-checkout branch and returns its tip", async () => {
    const workspace = await createWorkspace({
      gitProvider: "github",
      owner: "owner",
      repo: "repo",
      branch: "main",
    });
    dirs.push(workspace.dir);

    expect(workspace.tipSha).toBe("tip-from-git");
    await expect(fs.access(path.join(workspace.dir, ".git"))).resolves.toBeUndefined();

    const clone = mockRunGit.mock.calls.find(([opts]) => opts.args.includes("clone"))?.[0];
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
  });

  it("removes the workspace on dispose", async () => {
    const workspace = await createWorkspace({
      gitProvider: "github",
      owner: "owner",
      repo: "repo",
      branch: "main",
    });

    await disposeWorkspace(workspace.dir);

    await expect(fs.access(workspace.dir)).rejects.toBeTruthy();
  });

  it("resolves the remote tip without cloning", async () => {
    await expect(
      remoteTipSha({ gitProvider: "github", owner: "owner", repo: "repo", branch: "main" }),
    ).resolves.toBe("abc123");
    expect(mockRunGit.mock.calls.some(([opts]) => opts.args.includes("clone"))).toBe(false);
  });

  it("reports a missing branch as BranchNotFound", async () => {
    lsRemoteEmpty = true;

    await expect(
      remoteTipSha({ gitProvider: "github", owner: "owner", repo: "repo", branch: "nope" }),
    ).rejects.toMatchObject({ code: "BranchNotFound" });
  });
});
