import { env } from "@/config/env";
import { GithubAdapter } from "@/shared/integrations/git-provider/github-adapter";

export type { GitProvider } from "@/shared/integrations/git-provider/provider";
export type {
  Repository,
  RepositoryFilters,
  ConnectionStatus,
} from "@/shared/integrations/git-provider/types";

const providerCache = new Map<string | null, GithubAdapter>();

function createProvider(token: string | null) {
  const resolved = token || env.GITHUB_TOKEN;
  if (env.GIT_PROVIDER === "github" || !env.GIT_PROVIDER) {
    return new GithubAdapter(resolved);
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
