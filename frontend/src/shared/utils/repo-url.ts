export type ParsedRepoUrl = {
  owner: string;
  repo: string;
};

/**
 * Parses a GitHub repository URL into owner/repo.
 * Accepts forms like:
 *  - https://github.com/owner/repo
 *  - github.com/owner/repo
 *  - owner/repo
 *  - https://github.com/owner/repo.git
 *  - https://github.com/owner/repo/tree/main
 * Returns null when there is no `owner/repo` pair to extract.
 */
export function parseRepoUrl(input: string): ParsedRepoUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const cleaned = trimmed
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^github\.com\//i, "");

  const [owner, repo] = cleaned.split("/").filter(Boolean);
  if (!owner || !repo) return null;

  return { owner, repo: repo.replace(/\.git$/i, "") };
}
