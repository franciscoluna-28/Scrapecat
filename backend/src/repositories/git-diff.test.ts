import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import git from "isomorphic-git";
import { getCommitDiffStats } from "@/repositories/git-diff";

let dir: string;

async function makeCommit(opts: {
  message: string;
  files?: { name: string; content: string | Buffer }[];
  remove?: string[];
}): Promise<string> {
  for (const f of opts.files ?? []) {
    const p = path.join(dir, f.name);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, f.content);
    await git.add({ fs, dir, filepath: f.name });
  }
  for (const name of opts.remove ?? []) {
    await git.remove({ fs, dir, filepath: name });
  }
  return git.commit({
    fs,
    dir,
    message: opts.message,
    author: { name: "tester", email: "t@example.com", timestamp: Math.floor(Date.now() / 1000) },
  });
}

async function statsBetween(parentSha: string | null, commitSha: string) {
  return getCommitDiffStats({ dir, parentSha, commitSha });
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "gitdiff-"));
  await git.init({ fs, dir });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("getCommitDiffStats", () => {
  it("reports modified files with added/deleted line counts", async () => {
    const c1 = await makeCommit({
      message: "c1",
      files: [{ name: "a.txt", content: "hello\nworld\n" }],
    });
    const c2 = await makeCommit({
      message: "c2",
      files: [{ name: "a.txt", content: "hello\nuniverse\nthere\n" }],
    });

    const stats = await statsBetween(c1, c2);
    expect(stats).toEqual({
      filesChanged: 1,
      additions: 2,
      deletions: 1,
      files: [{ filepath: "a.txt", status: "modified", additions: 2, deletions: 1 }],
    });
  });

  it("reports added and deleted files", async () => {
    const c1 = await makeCommit({
      message: "c1",
      files: [
        { name: "keep.txt", content: "k\n" },
        { name: "gone.txt", content: "bye\n" },
      ],
    });
    const c2 = await makeCommit({
      message: "c2",
      files: [{ name: "new.txt", content: "hi\n" }],
      remove: ["gone.txt"],
    });

    const stats = await statsBetween(c1, c2);
    expect(stats.filesChanged).toBe(2);
    expect(stats.files).toEqual(
      expect.arrayContaining([
        { filepath: "gone.txt", status: "deleted", additions: 0, deletions: 1 },
        { filepath: "new.txt", status: "added", additions: 1, deletions: 0 },
      ]),
    );
  });

  it("treats the root commit as all files added", async () => {
    const c1 = await makeCommit({
      message: "root",
      files: [
        { name: "a.txt", content: "one\ntwo\n" },
        { name: "nested/b.txt", content: "three\n" },
      ],
    });

    const stats = await statsBetween(null, c1);
    expect(stats.filesChanged).toBe(2);
    expect(stats.files.map((f) => f.status)).toEqual(["added", "added"]);
    expect(stats.additions).toBe(3);
    expect(stats.deletions).toBe(0);
  });

  it("counts binary files as changed but with zero lines", async () => {
    const c1 = await makeCommit({
      message: "root",
      files: [{ name: "data.bin", content: Buffer.from([0, 1, 2, 3, 255]) }],
    });
    const c2 = await makeCommit({
      message: "add text",
      files: [{ name: "readme.md", content: "hello\n" }],
    });

    const stats = await statsBetween(null, c1);
    expect(stats).toEqual({
      filesChanged: 1,
      additions: 0,
      deletions: 0,
      files: [{ filepath: "data.bin", status: "added", additions: 0, deletions: 0 }],
    });

    const changed = await statsBetween(c1, c2);
    expect(changed.filesChanged).toBe(1);
    expect(changed.files[0]).toEqual({
      filepath: "readme.md",
      status: "added",
      additions: 1,
      deletions: 0,
    });
  });

  it("reports zero changes for an empty commit", async () => {
    const c1 = await makeCommit({
      message: "c1",
      files: [{ name: "a.txt", content: "hello\n" }],
    });
    const c2 = await git.commit({
      fs,
      dir,
      message: "empty",
      author: { name: "tester", email: "t@example.com", timestamp: Math.floor(Date.now() / 1000) },
    });

    const stats = await statsBetween(c1, c2);
    expect(stats.filesChanged).toBe(0);
    expect(stats.files).toEqual([]);
  });
});
