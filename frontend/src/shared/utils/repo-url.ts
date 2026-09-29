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

/** Matches a `:::report` opening fence, tolerating indent, CRLF, and trailing spaces. */
const REPORT_OPEN = /^[ \t]*:::report[^\S\r\n]*(?:\r?\n)?/m;
/** Matches a closing `:::` at the start of a line or at the very end, tolerating CRLF/spacing. */
const REPORT_CLOSE = /(?:^|\r?\n)[ \t]*:::[ \t]*(?:\r?\n|$)|:::[ \t]*$/m;

/**
 * Splits the content into a string before the artifact and the artifact itself.
 *
 * Tolerant of an unterminated block so a report streams into its card instead of
 * briefly rendering the raw `:::report ... :::` fence as markdown.
 */
export function splitArtifact(content: string): { before: string; artifact: string | null } {
  const open = content.match(REPORT_OPEN);
  if (!open) return { before: content, artifact: null };

  const before = content.slice(0, open.index ?? 0).trim();
  const rest = content.slice((open.index ?? 0) + open[0].length);
  const close = rest.match(REPORT_CLOSE);
  if (!close) return { before, artifact: rest.trim() };

  const artifact = rest.slice(0, close.index ?? 0).trim();
  return { before, artifact };
}