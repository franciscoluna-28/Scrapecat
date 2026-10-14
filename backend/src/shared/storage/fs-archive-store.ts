import type { ArchiveStore } from "./archive-store";

/**
 * Default store: local disk already *is* the archive, so there is nowhere to
 * hydrate from (null → clone) and nothing to persist. Byte-identical to the
 * pre-store behavior.
 */
export function createFsArchiveStore(): ArchiveStore {
  return {
    async hydrate() {
      return null;
    },
    async dehydrate() {
      // no-op
    },
  };
}
