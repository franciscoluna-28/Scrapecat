"use client";

import useSWR from "swr";
import { format } from "date-fns";
import { GitHubCommit } from "@/src/shared/types";
import { fetcher } from "@/src/shared/lib/fetch";
import { SWRCONFIG } from "@/src/shared/data/app";

/**
 * Builds the API URL for fetching commits.
 *
 * @param owner - Repository owner login
 * @param repo - Repository name
 * @param startDate - Start date in YYYY-MM-DD format (required)
 * @param endDate - End date in YYYY-MM-DD format (defaults to today)
 * @returns The API URL string, or null if startDate is not provided
 */
export function getCommitsUrl(
  owner: string,
  repo: string,
  startDate?: string,
  endDate?: string,
): string | null {
  if (!startDate) return null;

  const today = format(new Date(), "yyyy-MM-dd");
  const finalEndDate = endDate || today;

  return `/api/commits?owner=${owner}&repo=${repo}&limit=100&startDate=${startDate}&endDate=${finalEndDate}`;
}

/** Return type for the useCommits hook */
type UseCommitsReturn = {
  /** Array of fetched commits, empty if not loaded yet */
  commits: GitHubCommit[];
  /** Total number of commits found */
  count: number;
  /** Whether data is currently being fetched (initial load or revalidation) */
  isLoading: boolean;
  /** Whether any fetch is in progress (includes background updates) */
  isValidating: boolean;
  /** Combined loading state - true during any fetch operation */
  isFetching: boolean;
  /** Error object if the fetch failed, null otherwise */
  error: Error | null;
  /** Whether an error occurred */
  hasError: boolean;
};

/**
 * React hook for fetching commits using SWR.
 * Provides automatic caching, revalidation, and deduplication.
 *
 * @param owner - Repository owner login
 * @param repo - Repository name
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - Optional end date in YYYY-MM-DD format
 * @returns Object containing commits data and loading states
 *
 * @example
 * ```tsx
 * const { commits, count, isFetching, hasError } = useCommits(
 *   "facebook",
 *   "react",
 *   "2024-01-01",
 *   "2024-12-31"
 * );
 * ```
 */
export function useCommits(
  owner: string,
  repo: string,
  startDate?: string,
  endDate?: string,
): UseCommitsReturn {
  const url = getCommitsUrl(owner, repo, startDate, endDate);

  const { data, error, isLoading, isValidating } = useSWR<{
    commits: GitHubCommit[];
  }>(url, fetcher, SWRCONFIG);

  const commits = data?.commits ?? [];

  return {
    commits,
    count: commits.length,
    isLoading,
    isValidating,
    isFetching: isLoading || isValidating,
    error: error ?? null,
    hasError: !!error,
  };
}
