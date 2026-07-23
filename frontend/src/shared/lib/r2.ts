import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { nanoid } from "nanoid";

export type ImageAsset = {
  originalUrl: string;
  r2Url: string;
  commitSha: string;
  commitMessage: string;
};

function client() {
  const endpoint = process.env.R2_ENDPOINT;
  if (!endpoint) {
    console.error("[R2] Missing R2_ENDPOINT env var");
    throw new Error("R2_ENDPOINT not configured");
  }
  return new S3Client({
    region: "auto",
    endpoint: endpoint.replace(/\/$/, ""),
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

/** Resolve a github.com/user-attachments/ URL to a public CDN URL via GraphQL */
async function resolveCdnUrl(imageUrl: string, owner: string, repo: string, prNumber: number): Promise<string> {
  if (!imageUrl.startsWith("https://github.com/")) return imageUrl;

  try {
    console.log(`[R2] Resolving PR #${prNumber} via GraphQL`);
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "User-Agent": "commits-ai/1.0",
      },
      body: JSON.stringify({
        query: `
          query($owner: String!, $repo: String!, $pr: Int!) {
            repository(owner: $owner, name: $repo) {
              pullRequest(number: $pr) { bodyHTML }
            }
          }
        `,
        variables: { owner, repo, pr: prNumber },
      }),
    });

    if (!res.ok) { console.error(`[R2] GraphQL failed: ${res.status}`); return imageUrl; }

    const json: any = await res.json();
    const html: string | undefined = json?.data?.repository?.pullRequest?.bodyHTML;
    if (!html) { console.error(`[R2] No bodyHTML in GraphQL response`); return imageUrl; }

    const uuid = imageUrl.split("/").pop();
    if (!uuid) return imageUrl;

    // Match both <img src> and <a href> with CDN URLs containing the UUID
    const m = new RegExp(
      `(?:src|href)="(https:\\/\\/(?:private-)?user-images\\.githubusercontent\\.com[^"]*${uuid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"]*)"`,
      "i",
    ).exec(html);
    if (m) { console.log(`[R2] Found CDN URL via GraphQL`); return m[1]; }

    // Fallback: first CDN URL in the HTML
    const fallback = /(?:src|href)="(https:\/\/(?:private-)?user-images\.githubusercontent\.com[^"]*)"/i.exec(html);
    if (fallback) { console.log(`[R2] Fallback CDN URL`); return fallback[1]; }

    console.error(`[R2] No CDN URLs in bodyHTML`);
    return imageUrl;
  } catch (err) {
    console.error(`[R2] resolveCdnUrl error:`, err);
    return imageUrl;
  }
}

export async function uploadImagesToR2(
  images: { url: string; commitSha: string; commitMessage: string; prNumber: number }[],
  reportId: string,
  owner: string,
  repo: string,
): Promise<ImageAsset[]> {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    console.error("[R2] Missing bucket or publicUrl env vars");
    return [];
  }

  const s3 = client();
  const results: ImageAsset[] = [];
  const seen = new Set<string>();

  for (const img of images) {
    if (seen.has(img.url)) continue;
    seen.add(img.url);

    try {
      const downloadUrl = img.prNumber > 0
        ? await resolveCdnUrl(img.url, owner, repo, img.prNumber)
        : img.url;

      console.log(`[R2] Downloading from: ${downloadUrl.slice(0, 100)}`);

      let buffer: ArrayBuffer;
      let contentType = "image/png";

      const resp = await fetch(downloadUrl, { headers: { "User-Agent": "commits-ai/1.0" } });
      if (!resp.ok) { console.error(`[R2] Download failed: ${resp.status}`); continue; }
      buffer = await resp.arrayBuffer();
      contentType = resp.headers.get("content-type") || "image/png";

      const key = `${reportId}/${nanoid(16)}.png`;
      console.log(`[R2] Uploading to: ${bucket}/${key}`);
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key: key,
        Body: new Uint8Array(buffer),
        ContentType: contentType,
      }));

      results.push({
        originalUrl: img.url,
        r2Url: `${publicUrl}/${key}`,
        commitSha: img.commitSha,
        commitMessage: img.commitMessage,
      });
    } catch (err) {
      console.error(`[R2] Upload error:`, err);
    }
  }

  return results;
}
