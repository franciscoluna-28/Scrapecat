import { env } from "@/config/env";
import { GithubAdapter } from "@/shared/integrations/git-provider/github-adapter";
import { GitlabAdapter } from "@/shared/integrations/git-provider/gitlab-adapter";
import { normalizeGitlabHost } from "@/shared/integrations/git-provider/gitlab-client";
import type { GitProvider } from "@/shared/integrations/git-provider/provider";

/**
 * App-layer git providers. Deliberately separate from the DB enum: the
 * persistence layer owns its own type, and the application maps between them.
 */
export const GIT_PROVIDERS = ["github", "gitlab"] as const;
export type GitProviderId = (typeof GIT_PROVIDERS)[number];

/**
 * Provider-specific wiring for a git host: which env key holds its token, how
 * its web/clone URLs look, which HTTP auth header to send to `git`, and how to
 * construct its client. Keeping these in one place means adding a host is a
 * registry entry rather than a change to the clone/ingest pipeline.
 */
export type GitProviderConfig = {
  id: GitProviderId;
  /** Web/API origin for the host (env-driven for self-hosted GitLab). */
  host: string;
  tokenEnvKey: "GITHUB_TOKEN" | "GITLAB_TOKEN";
  commitPath: (owner: string, repo: string, sha: string) => string;
  cloneUrl: (owner: string, repo: string) => string;
  /** Value for `http.extraheader=AUTHORIZATION: <value>`. */
  authorization: (token: string) => string;
  createAdapter: (token: string | null) => GitProvider;
};

/** Self-hosted instances are supported by pointing GITLAB_HOST at the install. */
const GITLAB_HOST = normalizeGitlabHost(env.GITLAB_HOST);

const GITHUB: GitProviderConfig = {
  id: "github",
  host: "https://github.com",
  tokenEnvKey: "GITHUB_TOKEN",
  commitPath: (owner, repo, sha) => `https://github.com/${owner}/${repo}/commit/${sha}`,
  cloneUrl: (owner, repo) => `https://github.com/${owner}/${repo}.git`,
  authorization: (token) =>
    `basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
  createAdapter: (token) => new GithubAdapter(token),
};

const GITLAB: GitProviderConfig = {
  id: "gitlab",
  host: GITLAB_HOST,
  tokenEnvKey: "GITLAB_TOKEN",
  commitPath: (owner, repo, sha) =>
    `${GITLAB_HOST}/${owner}/${repo}/-/commit/${sha}`,
  cloneUrl: (owner, repo) => `${GITLAB_HOST}/${owner}/${repo}.git`,
  // GitLab authenticates HTTPS git with a PAT as the `oauth2` user.
  authorization: (token) =>
    `basic ${Buffer.from(`oauth2:${token}`).toString("base64")}`,
  createAdapter: (token) => new GitlabAdapter(token, GITLAB_HOST),
};

const REGISTRY: Partial<Record<GitProviderId, GitProviderConfig>> = {
  github: GITHUB,
  gitlab: GITLAB,
};

/**
 * Returns the config for a provider, or throws when that provider has no
 * implementation. The provider always comes from the project/request — there is
 * deliberately no global default.
 */
export function getGitProviderConfig(provider: GitProviderId): GitProviderConfig {
  const config = REGISTRY[provider];
  if (!config) {
    throw new Error(`Git provider "${provider}" is not implemented yet`);
  }
  return config;
}

export function isGitProviderId(value: string): value is GitProviderId {
  return (GIT_PROVIDERS as readonly string[]).includes(value);
}