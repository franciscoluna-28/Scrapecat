/**
 * Keys used by Next.js/Redis cache mechanism to prevent unnecessary API calls to GitHub
 * These tags are used with cacheTag() to invalidate cached data when repositories change
 */
export const GITHUB_CACHE_TAGS = {
  REPOSITORIES: "github:repositories",
  BY_REPOSITORY_NAME: (name: string) => `github:repository:${name}`,
} as const;
