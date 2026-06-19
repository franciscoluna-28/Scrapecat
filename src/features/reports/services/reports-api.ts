"use client";

import useSWR from "swr";

interface Report {
  id: string;
  githubRepositoryName: string;
  githubProjectId: number;
  startDate: string;
  endDate: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
}

interface DistinctProject {
  id: number;
  name: string;
}

interface ReportsResponse {
  reports: Report[];
  distinctProjects: DistinctProject[];
}

type UseReportsReturn = {
  reports: Report[];
  distinctProjects: DistinctProject[];
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

  const url = `/api/reports${params.toString() ? `?${params.toString()}` : ""}`;

  const { data, error, isLoading, isValidating } =
    useSWR<ReportsResponse>(url);

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
