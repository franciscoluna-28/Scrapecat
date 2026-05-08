import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GitHubCommit } from "../types";

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
export const processCommitsForAiReport = (
  commits: GitHubCommit[],
): ProcessedCommit[] => {
  return commits.map((commit) => ({
    sha: commit.sha, // Include SHA as required by API schema
    message: commit.commit.message, // Full commit message for better context
    author: commit.commit.author?.name || "Unknown",
    url: commit.html_url, // Renamed from html_url to match API schema
    date: commit.commit.author?.date
      ? new Date(commit.commit.author.date).toLocaleDateString("en-US")
      : "Unknown",
  }));
};

