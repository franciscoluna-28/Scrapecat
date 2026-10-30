import type { GitProviderId } from "@/src/shared/constants";

export type ParsedRepoUrl = {
  owner: string;
  repo: string;
  /** Set when the URL host identifies a provider (github.com, gitlab.com, …). */
  provider?: GitProviderId;
};

/** Path segments that mark the start of a UI route after `owner/repo`. */
const PATH_MARKERS = new Set([
  "-",
  "tree",
  "blob",
  "commits",
  "tags",
  "branches",
  "releases",
]);

function isHostSegment(segment: string): boolean {
  return /^[^/\s]+\.[^/\s]+$/.test(segment) || segment.toLowerCase() === "localhost";
}

/**
 * Best-effort provider detection from the host. Self-hosted instances on
 * arbitrary domains are left undefined and fall back to the selected provider.
 */
function inferProvider(host?: string): GitProviderId | undefined {
  const normalized = host?.toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes("github")) return "github";
  if (normalized.includes("gitlab")) return "gitlab";
  return undefined;
}

/**
 * Parses a repository URL into owner/repo.
 * Accepts GitHub and GitLab forms (including nested GitLab groups and
 * self-hosted hosts):
 *  - https://github.com/owner/repo
 *  - github.com/owner/repo
 *  - owner/repo
 *  - https://github.com/owner/repo.git
 *  - https://github.com/owner/repo/tree/main
 *  - https://gitlab.com/group/subgroup/repo/-/tree/main
 * Returns null when there is no `owner/repo` pair to extract.
 */
export function parseRepoUrl(input: string): ParsedRepoUrl | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let path = trimmed.replace(/^https?:\/\//i, "");
  path = path.split(/[?#]/)[0];

  const segments = path.split("/").filter(Boolean);
  // Drop a leading host segment (github.com, gitlab.com, self-hosted instances
  // such as git.example.com), remembering it for provider detection.
  const first = segments[0];
  const host = first && isHostSegment(first) ? segments.shift() : undefined;
  const provider = inferProvider(host);

  // Stop at the first UI route marker (only meaningful after `owner/repo`).
  const markerIndex = segments.findIndex(
    (segment, index) => index >= 2 && PATH_MARKERS.has(segment.toLowerCase()),
  );
  const repoPath = markerIndex === -1 ? segments : segments.slice(0, markerIndex);
  if (repoPath.length < 2) return null;

  const repo = repoPath[repoPath.length - 1].replace(/\.git$/i, "");
  const owner = repoPath.slice(0, -1).join("/");
  if (!owner || !repo) return null;

  return provider ? { owner, repo, provider } : { owner, repo };
}
