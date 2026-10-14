/**
 * Warm-cache adapter for git repo archives. The archive (a `--no-checkout`
 * clone) can live on local disk only (fs), in object storage (s3), or in memory
 * (tests). GitHub remains the source of truth; this is only a cache, so a
 * missing/failed hydrate is always recoverable by cloning.
 */
export type ArchiveKey = {
  owner: string;
  repo: string;
  branch: string;
};

export type ArchiveHydration = {
  tipSha: string;
};

export interface ArchiveStore {
  /**
   * Restores the archive for `key` into `destDir`. Returns the stored tip SHA,
   * or null when no archive is cached (caller falls back to a clone).
   */
  hydrate(key: ArchiveKey, destDir: string): Promise<ArchiveHydration | null>;

  /**
   * Persists `srcDir` as the archive for `key` at `tipSha`. Implementations
   * are idempotent: if the stored archive is already at `tipSha`, they no-op.
   * A crash mid-write must leave the previous archive intact (atomic replace).
   */
  dehydrate(srcDir: string, key: ArchiveKey, tipSha: string): Promise<void>;
}
