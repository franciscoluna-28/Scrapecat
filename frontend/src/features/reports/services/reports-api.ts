"use client";

import useSWR from "swr";
import type { paths } from "@/src/shared/api/types";

type ReportsListData = paths["/api/v1/reports"]["get"]["responses"][200]["content"]["application/json"];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useReports(projectId?: number) {
  const params = new URLSearchParams();
  if (projectId !== undefined) {
    params.set("projectId", String(projectId));
  }

  const url = `${API_URL}/api/v1/reports${params.toString() ? `?${params.toString()}` : ""}`;

  const { data, error, isLoading, isValidating } = useSWR<ReportsListData>(url);

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
