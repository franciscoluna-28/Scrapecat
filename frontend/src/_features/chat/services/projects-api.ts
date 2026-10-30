"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrap } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";

export function useProjects() {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.projects.list,
    queryFn: () => unwrap(apiClient.GET("/api/v1/projects")),
  });

  return {
    projects: data?.projects ?? [],
    isLoading,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}
