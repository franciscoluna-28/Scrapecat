/**
 * Single source of truth for the git host web base, so call sites stop
 * hardcoding `https://github.com`. GitHub-only today — the provider seam in
 * `index.ts` will pick a host per provider once a GitLab adapter exists.
 */
export const GIT_WEB_BASE = "https://github.com";

export function commitUrl(owner: string, repo: string, sha: string): string {
  return `${GIT_WEB_BASE}/${owner}/${repo}/commit/${sha}`;
}

export function cloneUrl(owner: string, repo: string): string {
  return `${GIT_WEB_BASE}/${owner}/${repo}.git`;
}