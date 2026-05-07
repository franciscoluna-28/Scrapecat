/** Global app configuration constants */
export const APP_CONFIG = {
    commits: {
        MAX_PER_PAGE: 100,
        MAX_LIMIT: 100,
    },
}

/** Global SWR configuration */
export const SWRCONFIG = {
  /** Disable revalidation on window focus to reduce API calls */
  revalidateOnFocus: false,
  /** Dedupe requests within 5 seconds */
  dedupingInterval: 5000,
  /** Keep showing previous data while fetching new data */
  keepPreviousData: true,
} as const;