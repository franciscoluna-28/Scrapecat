"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import type { ReportDetail, ReportSummary } from "@/src/shared/types";

export function useReports(projectId?: string) {
  const query = projectId ? { projectId } : undefined;
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
