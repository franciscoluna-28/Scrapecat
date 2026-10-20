/**
 * App-layer git providers. Deliberately separate from the DB enum: the
 * persistence layer owns its own type, and the application maps between them.
 * `gitlab` is a valid provider identity but has no implementation yet.
 */
export const GIT_PROVIDERS = ["github", "gitlab"] as const;
export type GitProviderId = (typeof GIT_PROVIDERS)[number];

/**
 * Provider-specific wiring for a git host: which credential/env key holds its
 * token, how its web/clone URLs look, and which HTTP auth header to send to
 * `git`. Keeping these in one place means adding a host is a registry entry
 * rather than a change to the clone/ingest pipeline.
 */
export type GitProviderConfig = {
  id: GitProviderId;
  credentialProvider: GitProviderId;
  tokenEnvKey: "GITHUB_TOKEN";
  commitPath: (owner: string, repo: string, sha: string) => string;
  cloneUrl: (owner: string, repo: string) => string;
  /** Value for `http.extraheader=AUTHORIZATION: <value>`. */
  authorization: (token: string) => string;
};

const GITHUB: GitProviderConfig = {
  id: "github",
  credentialProvider: "github",
  tokenEnvKey: "GITHUB_TOKEN",
  commitPath: (owner, repo, sha) => `https://github.com/${owner}/${repo}/commit/${sha}`,
  cloneUrl: (owner, repo) => `https://github.com/${owner}/${repo}.git`,
  authorization: (token) =>
    `basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
};

const REGISTRY: Partial<Record<GitProviderId, GitProviderConfig>> = {
  github: GITHUB,
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