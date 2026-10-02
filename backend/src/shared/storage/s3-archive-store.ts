import fs from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";
import { packDirectory, unpackArchive } from "./tar-archive";
import type { ArchiveKey, ArchiveStore } from "./archive-store";

type S3Module = typeof import("@aws-sdk/client-s3");
type S3Client = InstanceType<S3Module["S3Client"]>;

let s3Promise: Promise<{ client: S3Client; mod: S3Module }> | null = null;

/** Lazily builds the S3 client so fs/memory modes never load the AWS SDK. */
async function getClient(): Promise<{ client: S3Client; mod: S3Module }> {
  if (!s3Promise) {
    s3Promise = (async () => {
      const mod = await import("@aws-sdk/client-s3");
      const client = new mod.S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT || undefined,
        forcePathStyle: env.S3_FORCE_PATH_STYLE,
        credentials: env.S3_ACCESS_KEY_ID
          ? {
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
      });
      return { client, mod };
    })();
  }
  return s3Promise;
}

function objectKey({ owner, repo, branch }: ArchiveKey): string {
  const prefix = env.S3_PREFIX.replace(/\/+$/, "");
  return `${prefix}/${owner}/${repo}/${branch}.tar.gz`;
}

function tmpFile(): string {
  return path.join(os.tmpdir(), `scrapecat-archive-${randomUUID()}.tar.gz`);
}

function isNotFound(error: unknown): boolean {
  const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return (
    err?.name === "NoSuchKey" ||
    err?.name === "NotFound" ||
    err?.$metadata?.httpStatusCode === 404
  );
}

function isNoSuchBucket(error: unknown): boolean {
  return (error as { name?: string })?.name === "NoSuchBucket";
}

/**
 * S3-backed warm cache (MinIO locally, real S3 in prod). Each branch is a
 * single `tar.gz` object with a `tip-sha` metadata header. Writes are a single
 * `PutObject` (atomic: an interrupted upload never corrupts the previous
 * archive); reads stream `GetObject` → temp file → tar extract, so neither
 * direction is buffered in RAM.
 */
export function createS3ArchiveStore(): ArchiveStore {
  if (!env.S3_BUCKET) {
    throw new Error("ARCHIVE_STORE=s3 requires S3_BUCKET to be set");
  }

  return {
    async hydrate(key, destDir) {
      const { client, mod } = await getClient();
      const tmp = tmpFile();
      try {
        let response;
        try {
          response = await client.send(
            new mod.GetObjectCommand({ Bucket: env.S3_BUCKET, Key: objectKey(key) }),
          );
        } catch (error) {
          if (isNotFound(error) || isNoSuchBucket(error)) return null;
          throw error;
        }

        const tipSha = response.Metadata?.["tip-sha"];
        if (!response.Body || !tipSha) return null;

        await pipeline(response.Body as NodeJS.ReadableStream, createWriteStream(tmp));
        await unpackArchive(tmp, destDir);
        logger.info(
          { ...key, tipSha, bucket: env.S3_BUCKET, store: "s3" },
          "archive hydrated",
        );
        return { tipSha };
      } finally {
        await fs.rm(tmp, { force: true });
      }
    },

    async dehydrate(srcDir, key, tipSha) {
      const { client, mod } = await getClient();
      const Bucket = env.S3_BUCKET;
      const Key = objectKey(key);

      // HEAD compare: skip the upload when the cache already has this tip.
      try {
        const head = await client.send(new mod.HeadObjectCommand({ Bucket, Key }));
        if (head.Metadata?.["tip-sha"] === tipSha) return;
      } catch (error) {
        if (!isNotFound(error) && !isNoSuchBucket(error)) throw error;
      }

      const tmp = tmpFile();
      try {
        await packDirectory(srcDir, tmp);
        const { size } = await fs.stat(tmp);
        await client.send(
          new mod.PutObjectCommand({
            Bucket,
            Key,
            Body: createReadStream(tmp),
            ContentLength: size,
            ContentType: "application/gzip",
            Metadata: { "tip-sha": tipSha },
          }),
        );
        logger.info(
          { ...key, tipSha, bucket: Bucket, store: "s3", bytes: size },
          "archive dehydrated",
        );
      } finally {
        await fs.rm(tmp, { force: true });
      }
    },
  };
}
