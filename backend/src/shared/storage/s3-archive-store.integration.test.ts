import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";

/**
 * Opt-in integration test against MinIO / real S3. Enable with:
 *   S3_INTEGRATION=1 S3_ENDPOINT=http://localhost:9000 \
 *   S3_ACCESS_KEY_ID=minioadmin S3_SECRET_ACCESS_KEY=minioadmin \
 *   pnpm test:integration
 */
const enabled = process.env.S3_INTEGRATION === "1";

describe.skipIf(!enabled)("s3 archive store (integration)", () => {
  it("round-trips an archive through object storage", async () => {
    process.env.ARCHIVE_STORE = "s3";
    process.env.S3_BUCKET ??= "scrapecat-archives";
    process.env.S3_ENDPOINT ??= "http://localhost:9000";
    process.env.S3_ACCESS_KEY_ID ??= "minioadmin";
    process.env.S3_SECRET_ACCESS_KEY ??= "minioadmin";
    process.env.S3_FORCE_PATH_STYLE ??= "true";

    const { createS3ArchiveStore } = await import("./s3-archive-store");
    const store = createS3ArchiveStore();
    const key = { owner: "o", repo: `r-${randomUUID()}`, branch: "main" };

    const src = path.join(os.tmpdir(), `s3-src-${randomUUID()}`);
    await fs.mkdir(path.join(src, ".git"), { recursive: true });
    await fs.writeFile(path.join(src, ".git", "HEAD"), "ref: refs/heads/main\n");

    try {
      await store.dehydrate(src, key, "s3tip");
      await fs.rm(src, { recursive: true, force: true });

      const dest = path.join(os.tmpdir(), `s3-dest-${randomUUID()}`);
      const result = await store.hydrate(key, dest);

      expect(result).toEqual({ tipSha: "s3tip" });
      expect(await fs.readFile(path.join(dest, ".git", "HEAD"), "utf8")).toBe(
        "ref: refs/heads/main\n",
      );
      await fs.rm(dest, { recursive: true, force: true });
    } finally {
      await fs.rm(src, { recursive: true, force: true });
    }
  });
});
