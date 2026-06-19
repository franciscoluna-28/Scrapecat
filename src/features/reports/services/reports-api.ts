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

interface ReportsResponse {
  reports: Report[];
  distinctProjects: string[];
}

type UseReportsReturn = {
  reports: Report[];
  distinctProjects: string[];
  isLoading: boolean;
  isValidating: boolean;
  isFetching: boolean;
  error: Error | null;
  hasError: boolean;
};

export function useReports(projectName?: string): UseReportsReturn {
  const params = new URLSearchParams();
  if (projectName) {
    params.set("projectName", projectName);
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
