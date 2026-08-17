import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import git from "isomorphic-git";
import { listCommitsInRange, getCommitDiff } from "@/repositories/git-reader";

let dir: string;

async function makeCommit(opts: {
  message: string;
  files: { name: string; content: string }[];
  removed?: string[];
  offsetSeconds: number;
}) {
  for (const f of opts.files) {
    const p = path.join(dir, f.name);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, f.content);
    await git.add({ fs, dir, filepath: f.name });
  }
  for (const r of opts.removed ?? []) {
    await git.remove({ fs, dir, filepath: r });
  }
  return git.commit({
    fs,
    dir,
    message: opts.message,
    author: {
      name: "tester",
      email: "t@example.com",
      timestamp: Math.floor(Date.now() / 1000) - opts.offsetSeconds,
    },
  });
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "gitreader-"));
  await git.init({ fs, dir });
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("listCommitsInRange", () => {
  it("returns commits newest-first with parent linkage", async () => {
    await makeCommit({ message: "c1", files: [{ name: "a.txt", content: "hello\n" }], offsetSeconds: 600 });
    await makeCommit({ message: "c2", files: [{ name: "a.txt", content: "hello\nworld\n" }], offsetSeconds: 300 });
    await makeCommit({ message: "c3", files: [{ name: "b.txt", content: "b\n" }], offsetSeconds: 0 });

    const commits = await listCommitsInRange({ dir, ref: "master" });
    expect(commits.map((c) => c.message)).toEqual(["c3", "c2", "c1"]);
    expect(commits[0].parentSha).toBeTruthy();
    expect(commits[0].date).toBeTruthy();
    expect(commits[0].author).toBe("tester");
  });

  it("filters by since/until bounds", async () => {
    await makeCommit({ message: "old", files: [{ name: "a.txt", content: "a\n" }], offsetSeconds: 100 });
    await makeCommit({ message: "mid", files: [{ name: "a.txt", content: "a\nb\n" }], offsetSeconds: 50 });
    await makeCommit({ message: "new", files: [{ name: "a.txt", content: "a\nb\nc\n" }], offsetSeconds: 10 });

    const since = new Date(Date.now() - 60_000);
    const until = new Date(Date.now() - 30_000);
    const commits = await listCommitsInRange({ dir, ref: "master", since, until });
    expect(commits.map((c) => c.message)).toEqual(["mid"]);
  });
});

describe("getCommitDiff", () => {
  it("reports added, modified, and deleted files with stats and patch", async () => {
    await makeCommit({
      message: "c1",
      files: [
        { name: "a.txt", content: "hello\n" },
        { name: "sub/b.txt", content: "b1\n" },
      ],
      offsetSeconds: 600,
    });
    await makeCommit({
      message: "c2",
      files: [
        { name: "a.txt", content: "hello\nworld\n" },
        { name: "c.txt", content: "c1\n" },
      ],
      removed: ["sub/b.txt"],
      offsetSeconds: 0,
    });

    const commits = await listCommitsInRange({ dir, ref: "master" });
    const diff = await getCommitDiff({ dir, commit: commits[0] });

    expect(diff.filesChanged.sort()).toEqual(["a.txt", "c.txt", "sub/b.txt"]);
    expect(diff.additions).toBeGreaterThanOrEqual(2);
    expect(diff.deletions).toBeGreaterThanOrEqual(1);
    expect(diff.patch).toContain("a.txt");
    expect(diff.patch).toContain("c.txt");
    expect(diff.patch).toContain("sub/b.txt");
  });

  it("handles the root commit (empty tree parent)", async () => {
    await makeCommit({ message: "root", files: [{ name: "a.txt", content: "hi\n" }], offsetSeconds: 0 });
    const commits = await listCommitsInRange({ dir, ref: "master" });
    const diff = await getCommitDiff({ dir, commit: commits[0] });
    expect(diff.filesChanged).toEqual(["a.txt"]);
    expect(diff.additions).toBeGreaterThanOrEqual(1);
  });
});
