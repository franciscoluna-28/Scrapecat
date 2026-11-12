import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  getCommitChangedFiles,
  getCommitsChangedFiles,
} from "@/rag/git/git-diff";
import { runGit } from "@/rag/git/git";
import { initRepo, addFile, removeFile, commit } from "@/rag/git/git-fixtures";

let dir: string;

async function makeCommit(opts: {
  message: string;
  files?: { name: string; content: string | Buffer }[];
  remove?: string[];
}): Promise<string> {
  for (const f of opts.files ?? []) {
    await addFile(dir, f.name, f.content);
  }
  for (const name of opts.remove ?? []) {
    await removeFile(dir, name);
  }
  return commit(dir, opts.message);
}

async function statsBetween(parentSha: string | null, commitSha: string) {
  return getCommitChangedFiles({ dir, parentSha, commitSha });
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "gitdiff-"));
  await initRepo(dir);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe("getCommitChangedFiles", () => {
  it("reports modified files", async () => {
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
      files: [{ filepath: "a.txt", status: "modified" }],
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
        { filepath: "gone.txt", status: "deleted" },
        { filepath: "new.txt", status: "added" },
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
  });

  it("counts binary files as changed", async () => {
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
      files: [{ filepath: "data.bin", status: "added" }],
    });

    const changed = await statsBetween(c1, c2);
    expect(changed.filesChanged).toBe(1);
    expect(changed.files[0]).toEqual({ filepath: "readme.md", status: "added" });
  });

  it("reports zero changes for an empty commit", async () => {
    const c1 = await makeCommit({
      message: "c1",
      files: [{ name: "a.txt", content: "hello\n" }],
    });
    const c2 = await commit(dir, "empty", { allowEmpty: true });

    const stats = await statsBetween(c1, c2);
    expect(stats.filesChanged).toBe(0);
    expect(stats.files).toEqual([]);
  });
});

describe("getCommitsChangedFiles", () => {
  it("batches file scopes for several commits", async () => {
    const c1 = await makeCommit({
      message: "root",
      files: [{ name: "a.txt", content: "one\n" }],
    });
    const c2 = await makeCommit({
      message: "second",
      files: [
        { name: "a.txt", content: "two\n" },
        { name: "b.txt", content: "new\n" },
      ],
    });
    const c3 = await commit(dir, "empty", { allowEmpty: true });

    const result = await getCommitsChangedFiles({ dir, shas: [c1, c2, c3] });

    expect(result.get(c1)).toEqual({
      filesChanged: 1,
      files: [{ filepath: "a.txt", status: "added" }],
    });
    expect(result.get(c2)?.files).toEqual(
      expect.arrayContaining([
        { filepath: "a.txt", status: "modified" },
        { filepath: "b.txt", status: "added" },
      ]),
    );
    expect(result.get(c3)).toEqual({ filesChanged: 0, files: [] });
  });

  it("keeps the first-parent diff for merge commits", async () => {
    await runGit({ cwd: dir, args: ["config", "user.email", "t@example.com"] });
    await runGit({ cwd: dir, args: ["config", "user.name", "tester"] });
    await makeCommit({
      message: "root",
      files: [{ name: "a.txt", content: "one\n" }],
    });
    await runGit({ cwd: dir, args: ["checkout", "-q", "-b", "feature"] });
    await makeCommit({
      message: "feature",
      files: [{ name: "b.txt", content: "feature\n" }],
    });
    await runGit({ cwd: dir, args: ["checkout", "-q", "master"] });
    await makeCommit({
      message: "main",
      files: [{ name: "c.txt", content: "main\n" }],
    });
    await runGit({
      cwd: dir,
      args: ["merge", "-q", "--no-ff", "feature", "-m", "merge feature"],
    });
    const merge = (
      await runGit({ cwd: dir, args: ["rev-parse", "HEAD"] })
    ).trim();

    const result = await getCommitsChangedFiles({ dir, shas: [merge] });

    expect(result.get(merge)?.files).toEqual([
      { filepath: "b.txt", status: "added" },
    ]);
  });
});
