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
