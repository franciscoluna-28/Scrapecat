"use client";

import useSWR from "swr";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type UseReportsReturn = {
  reports: any[];
  distinctProjects: { id: number; name: string }[];
  isLoading: boolean;
  isValidating: boolean;
  isFetching: boolean;
  error: Error | null;
  hasError: boolean;
};

export function useReports(projectId?: number): UseReportsReturn {
  const params = new URLSearchParams();
  if (projectId !== undefined) {
    params.set("projectId", String(projectId));
  }

  const url = `${API_URL}/api/reports${params.toString() ? `?${params.toString()}` : ""}`;

  const { data, error, isLoading, isValidating } = useSWR<{
    reports: any[];
    distinctProjects: { id: number; name: string }[];
  }>(url);

  return {
    reports: data?.reports ?? [],
    distinctProjects: data?.distinctProjects ?? [],
    isLoading,
    isValidating,
    isFetching: isLoading || isValidating,
    error: error ?? null,
    hasError: !!error,
  };
}
