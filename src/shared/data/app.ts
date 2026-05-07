/** Global app configuration constants */
export const APP_CONFIG = {
    commits: {
        MAX_PER_PAGE: 100,
        MAX_LIMIT: 100,
    },
}

/** Global SWR configuration
 * Why this and not Tanstack Query?
 * SWR is used to simplify the client data fetching and caching so we don't have to manage it manually without the Tanstack Query complexity.
 * https://swr.vercel.app/docs/global-configuration
 */
export const SWRCONFIG = {
  /** Disable revalidation on window focus to reduce API calls */
  revalidateOnFocus: false,
  /** Dedupe requests within 5 seconds */
  dedupingInterval: 5000,
  /** Keep showing previous data while fetching new data */
  keepPreviousData: true,
} as const;