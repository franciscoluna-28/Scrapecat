import { env } from "../../config/env";
import { GithubAdapter } from "./github-adapter";

export type { GitProvider } from "./provider";
export type {
  Repository,
  Commit,
  CommitDetail,
  PullRequest,
  RepositoryFilters,
  CommitParams,
  DateRangeParams,
  ConnectionStatus,
} from "./types";

let provider: ReturnType<typeof createProvider> | null = null;

function createProvider() {
  if (env.GIT_PROVIDER === "github" || !env.GIT_PROVIDER) {
    return new GithubAdapter(env.GITHUB_TOKEN);
  }
  return new GithubAdapter(env.GITHUB_TOKEN);
}

export function getGitProvider() {
  if (!provider) {
    provider = createProvider();
  }
  return provider;
}
