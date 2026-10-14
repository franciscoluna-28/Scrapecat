import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { packDirectory, unpackArchive } from "./tar-archive";
import type { ArchiveKey, ArchiveStore } from "./archive-store";

function keyOf({ owner, repo, branch }: ArchiveKey): string {
  return `${owner}/${repo}/${branch}`;
}

function tmpFile(): string {
  return path.join(os.tmpdir(), `scrapecat-archive-${randomUUID()}.tar.gz`);
}

/**
 * In-memory archive store for tests. Holds packed tar.gz buffers in a Map and
 * still goes through the real tar round-trip, so hydrate/dehydrate behavior is
 * exercised end to end without S3.
 */
export function createMemoryArchiveStore(): ArchiveStore {
  const store = new Map<string, { archive: Buffer; tipSha: string }>();

  return {
    async hydrate(key, destDir) {
      const entry = store.get(keyOf(key));
      if (!entry) return null;
      const tmp = tmpFile();
      try {
        await fs.writeFile(tmp, entry.archive);
        await unpackArchive(tmp, destDir);
        return { tipSha: entry.tipSha };
      } finally {
        await fs.rm(tmp, { force: true });
      }
    },

    async dehydrate(srcDir, key, tipSha) {
      if (store.get(keyOf(key))?.tipSha === tipSha) return;
      const tmp = tmpFile();
      try {
        await packDirectory(srcDir, tmp);
        store.set(keyOf(key), { archive: await fs.readFile(tmp), tipSha });
      } finally {
        await fs.rm(tmp, { force: true });
      }
    },
  };
}
