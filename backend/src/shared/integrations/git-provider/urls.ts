import {
  getGitProviderConfig,
  type GitProviderId,
} from "@/shared/integrations/git-provider/registry";

/** Provider-aware commit/clone URLs, so call sites never hardcode a host. */
export function commitUrl(
  provider: GitProviderId,
  owner: string,
  repo: string,
  sha: string,
): string {
  return getGitProviderConfig(provider).commitPath(owner, repo, sha);
}

export function cloneUrl(
  provider: GitProviderId,
  owner: string,
  repo: string,
): string {
  return getGitProviderConfig(provider).cloneUrl(owner, repo);
}