"use client";

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import type { ReportDetail, ReportSummary, StoredCommit } from "@/src/shared/types";

export function useReports(projectId?: string) {
  const query = projectId ? { projectId } : undefined;
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.reports.list(projectId),
    queryFn: () =>
      apiClient
        .GET("/api/v1/reports", {
          params: { query },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
  });

  return {
    reports: (data?.reports ?? []) as ReportSummary[],
    isLoading,
    isValidating: isFetching,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}

export function useReport(id: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.reports.detail(id),
    queryFn: () =>
      apiClient
        .GET("/api/v1/reports/{id}", {
          params: { path: { id } },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    enabled: !!id,
  });

  return {
    report: (data ?? null) as ReportDetail | null,
    isLoading,
    error: error ?? null,
  };
}

export function useReportCommitsInfinite(id: string, q?: string) {
  const {
    data,
    error,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.reports.commits(id, q),
    queryFn: ({ pageParam }) =>
      apiClient
        .GET("/api/v1/reports/{id}/commits", {
          params: {
            path: { id },
            query: {
              limit: 50,
              ...(q ? { q } : {}),
              ...(pageParam ? { cursor: pageParam } : {}),
            },
          },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!id,
  });

  return {
    commits: (data?.pages.flatMap((p) => p.commits) ?? []) as StoredCommit[],
    total: data?.pages[0]?.total ?? null,
    isLoading,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    error: error ?? null,
  };
}
