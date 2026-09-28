import { Octokit } from "@octokit/core";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";

/**
 * Single Octokit construction point (throttling + retry). A token is optional:
 * unauthenticated requests still work for public repos (lower 60/hr limit).
 *
 * For the public demo, use a *fine-grained* PAT scoped to "Public repositories
 * (read-only)" with no other permissions. GitHub then enforces that the token
 * can never read private repos or account data, even if our code is wrong.
 */
export const MyOctokit = Octokit.plugin(throttling, retry);

export function createOctokit(token?: string | null) {
  return new MyOctokit({
    auth: token ?? undefined,
    throttle: {
      onRateLimit: (retryAfter: number, options: any, _client: any, retryCount: number) => {
        console.warn(`Rate limit hit for ${options.method} ${options.url}`);
        if (retryCount < 3) {
          console.info(`Retrying after ${retryAfter} seconds`);
          return true;
        }
        return false;
      },
      onSecondaryRateLimit: (_retryAfter: number, options: any, _client: any) => {
        console.warn(`Secondary rate limit for ${options.method} ${options.url}`);
      },
    },
    retry: { doNotRetry: [400, 401, 403, 404, 410, 422, 451] },
  });
}

export type OctokitClient = ReturnType<typeof createOctokit>;
