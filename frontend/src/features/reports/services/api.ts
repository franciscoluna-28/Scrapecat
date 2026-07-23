"use client";

import useSWR from "swr";
import { format } from "date-fns";
import type { paths } from "@/src/shared/api/types";

type CommitsData = paths["/api/commits"]["get"]["responses"][200]["content"]["application/json"];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function getCommitsUrl(
  owner: string,
  repo: string,
  startDate?: string,
  endDate?: string,
  branch?: string,
): string | null {
  if (!startDate) return null;
  const today = format(new Date(), "yyyy-MM-dd");
  const finalEndDate = endDate || today;
  let url = `${API_URL}/api/commits?owner=${owner}&repo=${repo}&limit=100&startDate=${startDate}&endDate=${finalEndDate}`;
  if (branch) url += `&branch=${encodeURIComponent(branch)}`;
  return url;
}

export function useCommits({
  owner,
  repo,
  startDate,
  endDate,
  branch,
}: {
  owner: string;
  repo: string;
  startDate?: string;
  endDate?: string;
  branch?: string;
}) {
  const key = getCommitsUrl(owner, repo, startDate, endDate, branch);

  const { data, error, isLoading, isValidating } = useSWR<CommitsData>(key);

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

export function getRepositoriesUrl(filters: {
  type: string;
  sort: string;
  direction: string;
  per_page: number;
}): string {
  const params = new URLSearchParams({
    type: filters.type,
    sort: filters.sort,
    direction: filters.direction,
    per_page: filters.per_page.toString(),
  });
  return `${API_URL}/api/repositories?${params.toString()}`;
}

type RepositoriesData = paths["/api/repositories"]["get"]["responses"][200]["content"]["application/json"];

export function useRepositories(filters: {
  type: string;
  sort: string;
  direction: string;
  per_page: number;
}) {
  const url = getRepositoriesUrl(filters);

  const { data, error, isLoading, isValidating } = useSWR<RepositoriesData>(url);

  return {
    repositories: data ?? [],
    isLoading,
    isValidating,
    isFetching: isLoading || isValidating,
    error: error ?? null,
    hasError: !!error,
  };
}
