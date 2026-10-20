import { env } from "@/config/env";
import { GithubAdapter } from "@/shared/integrations/git-provider/github-adapter";
import {
  getGitProviderConfig,
  type GitProviderId,
} from "@/shared/integrations/git-provider/registry";

export type { GitProvider } from "@/shared/integrations/git-provider/provider";
export type {
  Repository,
  RepositoryFilters,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";
export type { GitProviderId } from "@/shared/integrations/git-provider/registry";
export { GIT_PROVIDERS, isGitProviderId } from "@/shared/integrations/git-provider/registry";
export { getGitProviderConfig } from "@/shared/integrations/git-provider/registry";
export { commitUrl, cloneUrl } from "@/shared/integrations/git-provider/urls";

const providerCache = new Map<string, GithubAdapter>();

/**
 * Returns the adapter for a provider (from the project/request) and token. The
 * token defaults to that provider's server-side env var. Unimplemented
 * providers fail fast instead of silently using GitHub.
 */
export function getGitProvider(provider: GitProviderId, token?: string | null) {
  const config = getGitProviderConfig(provider);
  const resolved = token || env[config.tokenEnvKey] || "";
  const key = `${config.id}:${resolved}`;

  let adapter = providerCache.get(key);
  if (!adapter) {
    adapter = new GithubAdapter(resolved);
    providerCache.set(key, adapter);
  }
  return adapter;
}