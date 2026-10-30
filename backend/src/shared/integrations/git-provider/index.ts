import {
  getGitProviderConfig,
  type GitProviderId,
} from "@/shared/integrations/git-provider/registry";
import type { GitProvider } from "@/shared/integrations/git-provider/provider";

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

/**
 * Returns the adapter for a provider (from the project/request) and token.
 * Callers resolve the token with `resolveGitToken`; there is no implicit env
 * fallback here, so token precedence lives in exactly one place.
 * Unimplemented providers fail fast instead of silently using GitHub.
 */
export function getGitProvider(
  provider: GitProviderId,
  token: string | null = null,
): GitProvider {
  return getGitProviderConfig(provider).createAdapter(token);
}