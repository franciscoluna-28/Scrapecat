import { env } from "@/config/env";
import { createFsArchiveStore } from "./fs-archive-store";
import { createMemoryArchiveStore } from "./memory-archive-store";
import { createS3ArchiveStore } from "./s3-archive-store";
import type { ArchiveStore } from "./archive-store";

export type { ArchiveHydration, ArchiveKey, ArchiveStore } from "./archive-store";
export { packDirectory, unpackArchive } from "./tar-archive";

let cached: ArchiveStore | null = null;

/** Resolves the configured archive store. `fs` is the zero-risk default. */
export function getArchiveStore(): ArchiveStore {
  if (cached) return cached;
  switch (env.ARCHIVE_STORE) {
    case "s3":
      cached = createS3ArchiveStore();
      break;
    case "memory":
      cached = createMemoryArchiveStore();
      break;
    default:
      cached = createFsArchiveStore();
  }
  return cached;
}

/** Test hook: drops the cached store so the next call re-reads the env. */
export function resetArchiveStore(): void {
  cached = null;
}
