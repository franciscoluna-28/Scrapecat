export type ExtractedImage = {
  url: string;
  alt: string;
  commitSha: string;
  commitMessage: string;
};

export function extractImagesFromPrBody(
  body: string,
  commitSha: string,
  commitMessage: string,
): ExtractedImage[] {
  const images: ExtractedImage[] = [];
  let m: RegExpExecArray | null;
  const mdRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  while ((m = mdRe.exec(body)) !== null) {
    images.push({ url: m[2], alt: m[1], commitSha, commitMessage });
  }
  const htmlRe = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  while ((m = htmlRe.exec(body)) !== null) {
    images.push({ url: m[1], alt: "", commitSha, commitMessage });
  }
  return images;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function extractReportTitle(markdown: string, fallback: string): string {
  const line = markdown
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.startsWith("# ") && !l.startsWith("## "));
  return line ? line.replace(/^#\s+/, "").trim() : fallback;
}
