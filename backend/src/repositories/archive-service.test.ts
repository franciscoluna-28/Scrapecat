import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

const mockHydrate = vi.fn();
const mockDehydrate = vi.fn();

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

vi.mock("@/shared/storage", () => ({
  getArchiveStore: () => ({ hydrate: mockHydrate, dehydrate: mockDehydrate }),
}));

vi.mock("@/repositories/git", () => ({
  runGit: (opts: { args: string[] }) => mockRunGit(opts),
  authArgs: () => [],
}));

vi.mock("@/github/token", () => ({
  resolveGithubToken: async () => null,
}));

import { ensureArchive } from "@/repositories/archive-service";

const dirs: string[] = [];

beforeEach(() => {
  dirs.length = 0;
  mockHydrate.mockReset();
  mockDehydrate.mockReset();
  mockRunGit.mockClear();
});

afterEach(async () => {
  await Promise.all(dirs.map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("archive-service store wiring", () => {
  it("hydrates from the store and skips the clone, then dehydrates the tip", async () => {
    const owner = "o";
    const repo = `r-${randomUUID()}`;
    const branch = "main";
    const destDir = path.resolve(".tmp-repos", owner, repo, branch);
    dirs.push(path.resolve(".tmp-repos", owner, repo));

    mockHydrate.mockImplementation(async (_key: unknown, dest: string) => {
      await fs.mkdir(path.join(dest, ".git"), { recursive: true });
      return { tipSha: "hydrated-tip" };
    });

    const archive = await ensureArchive({ owner, repo, branch });

    expect(archive.tipSha).toBe("tip-from-git");
    expect(mockHydrate).toHaveBeenCalledTimes(1);
    const cloneCalls = mockRunGit.mock.calls.filter(([o]) => o.args.includes("clone"));
    const fetchCalls = mockRunGit.mock.calls.filter(([o]) => o.args.includes("fetch"));
    expect(cloneCalls).toHaveLength(0);
    expect(fetchCalls).toHaveLength(1);
    expect(mockDehydrate).toHaveBeenCalledWith(destDir, { owner, repo, branch }, "tip-from-git");
  });

  it("clones when the store has no cached archive", async () => {
    const owner = "o";
    const repo = `r-${randomUUID()}`;
    const branch = "main";
    dirs.push(path.resolve(".tmp-repos", owner, repo));

    mockHydrate.mockResolvedValue(null);

    const archive = await ensureArchive({ owner, repo, branch });

    expect(archive.tipSha).toBe("tip-from-git");
    const cloneCalls = mockRunGit.mock.calls.filter(([o]) => o.args.includes("clone"));
    expect(cloneCalls).toHaveLength(1);
    expect(mockDehydrate).toHaveBeenCalledTimes(1);
  });
});
