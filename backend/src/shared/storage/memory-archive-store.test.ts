import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { createMemoryArchiveStore } from "./memory-archive-store";

const dirs: string[] = [];

async function scratch(): Promise<string> {
  const dir = path.join(os.tmpdir(), `archive-test-${randomUUID()}`);
  await fs.mkdir(path.join(dir, ".git"), { recursive: true });
  dirs.push(dir);
  return dir;
}

beforeEach(() => {
  dirs.length = 0;
});

afterEach(async () => {
  await Promise.all(dirs.map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe("memory archive store", () => {
  it("round-trips an archive and reports the stored tip", async () => {
    const store = createMemoryArchiveStore();
    const src = await scratch();
    await fs.writeFile(path.join(src, ".git", "HEAD"), "ref: refs/heads/main\n");

    await store.dehydrate(src, { owner: "o", repo: "r", branch: "main" }, "abc123");
    await fs.rm(src, { recursive: true, force: true });

    const dest = path.join(os.tmpdir(), `archive-dest-${randomUUID()}`);
    dirs.push(dest);
    const result = await store.hydrate({ owner: "o", repo: "r", branch: "main" }, dest);

    expect(result).toEqual({ tipSha: "abc123" });
    expect(await fs.readFile(path.join(dest, ".git", "HEAD"), "utf8")).toBe(
      "ref: refs/heads/main\n",
    );
  });

  it("hydrates null when nothing is cached", async () => {
    const store = createMemoryArchiveStore();
    const dest = path.join(os.tmpdir(), `archive-dest-${randomUUID()}`);
    dirs.push(dest);
    expect(await store.hydrate({ owner: "o", repo: "r", branch: "main" }, dest)).toBeNull();
  });

  it("keeps the cached archive when the tip is unchanged", async () => {
    const store = createMemoryArchiveStore();
    const src = await scratch();
    await fs.writeFile(path.join(src, ".git", "marker"), "first");
    await store.dehydrate(src, { owner: "o", repo: "r", branch: "main" }, "tip1");

    await fs.writeFile(path.join(src, ".git", "marker"), "second");
    await store.dehydrate(src, { owner: "o", repo: "r", branch: "main" }, "tip1");

    const dest = path.join(os.tmpdir(), `archive-dest-${randomUUID()}`);
    dirs.push(dest);
    const result = await store.hydrate({ owner: "o", repo: "r", branch: "main" }, dest);
    expect(result).toEqual({ tipSha: "tip1" });
    expect(await fs.readFile(path.join(dest, ".git", "marker"), "utf8")).toBe("first");
  });
});
