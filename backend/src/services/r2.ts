import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";
import { env } from "../config/env";

export type ImageAsset = {
  originalUrl: string;
  r2Url: string;
  commitSha: string;
  commitMessage: string;
};

function createS3Client() {
  if (!env.R2_ENDPOINT) throw new Error("R2_ENDPOINT not configured");
  return new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT.replace(/\/$/, ""),
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

async function resolveCdnUrl(imageUrl: string, owner: string, repo: string, prNumber: number): Promise<string> {
  if (!imageUrl.startsWith("https://github.com/")) return imageUrl;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        "User-Agent": "scrapecat/1.0",
      },
      body: JSON.stringify({
        query: `query($owner: String!, $repo: String!, $pr: Int!) {
          repository(owner: $owner, name: $repo) {
            pullRequest(number: $pr) { bodyHTML }
          }
        }`,
        variables: { owner, repo, pr: prNumber },
      }),
    });
    if (!res.ok) return imageUrl;
    const json: any = await res.json();
    const html: string | undefined = json?.data?.repository?.pullRequest?.bodyHTML;
    if (!html) return imageUrl;

    const uuid = imageUrl.split("/").pop();
    if (!uuid) return imageUrl;

    const m = new RegExp(
      `(?:src|href)="(https:\\/\\/(?:private-)?user-images\\.githubusercontent\\.com[^"]*${uuid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"]*)"`,
      "i",
    ).exec(html);
    if (m) return m[1];

    const fallback = /(?:src|href)="(https:\/\/(?:private-)?user-images\.githubusercontent\.com[^"]*)"/i.exec(html);
    return fallback?.[1] || imageUrl;
  } catch {
    return imageUrl;
  }
}

export async function uploadImagesToR2(
  images: { url: string; commitSha: string; commitMessage: string; prNumber: number }[],
  reportId: string,
  owner: string,
  repo: string,
): Promise<ImageAsset[]> {
  if (!env.R2_BUCKET_NAME || !env.R2_PUBLIC_URL) return [];

  const s3 = createS3Client();
  const results: ImageAsset[] = [];
  const seen = new Set<string>();

  for (const img of images) {
    if (seen.has(img.url)) continue;
    seen.add(img.url);

    try {
      const downloadUrl = img.prNumber > 0
        ? await resolveCdnUrl(img.url, owner, repo, img.prNumber)
        : img.url;

      const resp = await fetch(downloadUrl, { headers: { "User-Agent": "scrapecat/1.0" } });
      if (!resp.ok) continue;

      const buffer = await resp.arrayBuffer();
      const contentType = resp.headers.get("content-type") || "image/png";
      const key = `${reportId}/${nanoid(16)}.png`;

      await s3.send(new PutObjectCommand({
        Bucket: env.R2_BUCKET_NAME, Key: key,
        Body: new Uint8Array(buffer),
        ContentType: contentType,
      }));

      results.push({
        originalUrl: img.url,
        r2Url: `${env.R2_PUBLIC_URL}/${key}`,
        commitSha: img.commitSha,
        commitMessage: img.commitMessage,
      });
    } catch {
      continue;
    }
  }

  return results;
}
