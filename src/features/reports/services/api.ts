"use client";

import useSWR from "swr";
import { format } from "date-fns";
import { GitHubCommit, GitHubRepository } from "@/src/shared/types";

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

type UseCommitsReturn = {
  commits: GitHubCommit[];
  count: number;
  isLoading: boolean;
  isValidating: boolean;
  isFetching: boolean;
  error: Error | null;
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

  // The key is the URL, in case the URL changes, the request will be made again. Otherwise, it will use the cached data.
  const url = getCommitsUrl(owner, repo, startDate, endDate);

  const { data, error, isLoading, isValidating } = useSWR<{
    commits: GitHubCommit[];
  }>(url);

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

/** Parameters for fetching repositories */
type RepositoryFilters = {
  type: string;
  sort: string;
  direction: string;
  per_page: number;
};

/**
 * Builds the API URL for fetching repositories.
 *
 * @param filters - Filter and pagination options
 * @returns The API URL string with query parameters
 */
export function getRepositoriesUrl(filters: RepositoryFilters): string {
  const params = new URLSearchParams({
    type: filters.type,
    sort: filters.sort,
    direction: filters.direction,
    per_page: filters.per_page.toString(),
  });
  return `/api/repositories?${params.toString()}`;
}

/** Return type for the useRepositories hook */
type UseRepositoriesReturn = {
  repositories: GitHubRepository[];
  isLoading: boolean;
  isValidating: boolean;
  isFetching: boolean;
  error: Error | null;
  hasError: boolean;
};

/**
 * React hook for fetching repositories using SWR.
 * Provides automatic caching, revalidation, and deduplication.
 *
 * @param filters - Filter and pagination options for repositories
 * @returns Object containing repositories data and loading states
 *
 * @example
 * ```tsx
 * const { repositories, isFetching, hasError } = useRepositories({
 *   type: "all",
 *   sort: "updated",
 *   direction: "desc",
 *   per_page: 30,
 * });
 * ```
 */
export function useRepositories(
  filters: RepositoryFilters,
): UseRepositoriesReturn {

  // Same as useCommits, the key is the URL
  const url = getRepositoriesUrl(filters);

  const { data, error, isLoading, isValidating } = useSWR<GitHubRepository[]>(
    url,
  );

  const repositories = data ?? [];

  return {
    repositories,
    isLoading,
    isValidating,
    isFetching: isLoading || isValidating,
    error: error ?? null,
    hasError: !!error,
  };
}
