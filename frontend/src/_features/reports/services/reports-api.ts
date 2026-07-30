"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";

export function useReports(projectId?: number) {
  const query = projectId !== undefined ? { projectId: String(projectId) } : undefined;
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.reports.list(projectId),
    queryFn: () =>
      apiClient
        .GET("/api/v1/reports", {
          params: { query },
        })
        .then((r) => r.data),
  });

  return {
    reports: data?.reports ?? [],
    distinctProjects: data?.distinctProjects ?? [],
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
    report: data ?? null,
    isLoading,
    error: error ?? null,
  };
}
