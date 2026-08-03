"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import type { GitHubProject, StoredCommit } from "@/src/shared/types";

export function useProjects() {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.projects.list,
    queryFn: () => apiClient.GET("/api/v1/projects").then((r) => r.data),
  });

  return {
    projects: (data?.projects ?? []) as GitHubProject[],
    isLoading,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}

export function useProjectCommits(
  projectId?: string,
  params?: { startDate?: string; endDate?: string },
) {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.projects.commits(projectId ?? "", params),
    queryFn: () =>
      apiClient
        .GET("/api/v1/projects/{projectId}/commits", {
          params: { path: { projectId: projectId! }, query: params },
        })
        .then((r) => r.data),
    enabled: !!projectId,
  });

  return {
    commits: (data?.commits ?? []) as StoredCommit[],
    isLoading,
    error: error ?? null,
  };
}
