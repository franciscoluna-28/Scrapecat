import { createHash } from "node:crypto";

/**
 * Generic content hashing.
 *
 * `contentHashOf` is used as the staleness key for derived caches: the hash is
 * compared against the hash of the content the cache was built from, so the
 * algorithm must stay stable across runs.
 */
export function contentHashOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}
