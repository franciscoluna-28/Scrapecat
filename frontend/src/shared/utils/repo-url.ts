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
 */
export function parseRepoUrl(input: string): ParsedRepoUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(
    /(?:github\.com\/)?([^/]+)\/([^/]+?)(?:\.git)?(?:\/|$)/,
  );
  if (!match) return null;

  const owner = match[1];
  const repo = match[2];
  if (!owner || !repo) return null;

  return { owner, repo };
}

/** 
 * Splits the content into a string before the artifact and the artifact itself.
 */
export function splitArtifact(content: string): { before: string; artifact: string | null } {
  const m = content.match(/:::report\n([\s\S]*?)\n:::/);
  if (!m) return { before: content, artifact: null };
  const before = content.slice(0, m.index).trim();
  const artifact = m[1].trim();
  return { before, artifact };
}