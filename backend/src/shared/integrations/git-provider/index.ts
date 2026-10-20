import { env } from "@/config/env";
import { GithubAdapter } from "@/shared/integrations/git-provider/github-adapter";

export type { GitProvider } from "@/shared/integrations/git-provider/provider";
export type {
  Repository,
  RepositoryFilters,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";
export { GIT_WEB_BASE, commitUrl, cloneUrl } from "@/shared/integrations/git-provider/urls";

const providerCache = new Map<string | null, GithubAdapter>();

function createProvider(token: string | null): GithubAdapter {
  const resolved = token || env.GITHUB_TOKEN;
  // Only GitHub is implemented. Previously this conditional returned a GitHub
  // adapter on both branches, silently ignoring GIT_PROVIDER=gitlab — fail loud
  // instead so a misconfiguration can't masquerade as working GitLab support.
  if (env.GIT_PROVIDER && env.GIT_PROVIDER !== "github") {
    throw new Error(`Git provider "${env.GIT_PROVIDER}" is not implemented yet`);
  }
  return new GithubAdapter(resolved);
}

export function getGitProvider(token?: string | null) {
  const key = token ?? (env.GITHUB_TOKEN || null);
  let provider = providerCache.get(key);
  if (!provider) {
    provider = createProvider(key);
    providerCache.set(key, provider);
  }
  return provider;
}
