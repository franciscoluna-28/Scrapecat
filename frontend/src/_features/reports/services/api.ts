"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";

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
  const enabled = !!startDate;

  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.commits.list(owner, repo, { startDate, endDate, branch }),
    queryFn: () =>
      apiClient
        .GET("/api/v1/repositories/{owner}/{repo}/commits", {
          params: {
            path: { owner, repo },
            query: {
              limit: "100",
              startDate: startDate!,
              endDate: endDate || format(new Date(), "yyyy-MM-dd"),
              branch,
            },
          },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    enabled,
  });

  const commits = data?.commits ?? [];

  return {
    commits,
    count: commits.length,
    isLoading,
    isValidating: isFetching,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}

export function useRepositories(filters: {
  type: string;
  sort: string;
  direction: string;
  per_page: number;
}) {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.repositories.list(filters),
    queryFn: () =>
      apiClient
        .GET("/api/v1/repositories", {
          params: {
            query: {
              type: filters.type,
              sort: filters.sort,
              direction: filters.direction,
              per_page: String(filters.per_page),
            },
          },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
  });

  return {
    repositories: data ?? [],
    isLoading,
    isValidating: isFetching,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}

export function useBranches(owner: string, repo: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.branches.list(owner, repo),
    queryFn: () =>
      apiClient
        .GET("/api/v1/repositories/{owner}/{repo}/branches", {
          params: { path: { owner, repo } },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    enabled: !!owner && !!repo,
  });

  return {
    branches: data?.branches ?? [],
    isLoading,
    error: error ?? null,
  };
}
