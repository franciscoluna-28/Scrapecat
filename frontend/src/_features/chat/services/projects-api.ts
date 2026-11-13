"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, unwrap } from "@/src/shared/api/client";
import type { paths } from "@/src/shared/api/types";
import { queryKeys } from "@/src/shared/services/keys";

export type CreateProjectInput =
  paths["/api/v1/projects"]["post"]["requestBody"]["content"]["application/json"];

export function createProject(input: CreateProjectInput) {
  return unwrap(apiClient.POST("/api/v1/projects", { body: input }));
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
    },
  });
}

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
