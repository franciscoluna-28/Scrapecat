import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ProcessedCommit = {
  sha: string;
  message: string;
  author: string;
  url?: string;
  date: string;
};

/**
 * Process GitHub commits for AI report generation
 * Extracts only essential information to reduce token usage
 */
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

export const processCommitsForAiReport = (
  commits: ProcessedCommit[],
): ProcessedCommit[] => {
  return commits.map((commit) => ({
    sha: commit.sha,
    message: commit.message || "No commit message",
    author: commit.author || "Unknown",
    url: commit.url,
    date: commit.date
      ? new Date(commit.date).toLocaleDateString("en-US")
      : "Unknown",
  }));
};

