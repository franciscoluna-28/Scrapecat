"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { queryKeys } from "./keys";

export function useModels() {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.models.all,
    queryFn: () => apiClient.GET("/api/v1/models").then((r) => r.data),
  });

  return {
    models: data?.models ?? [],
    isLoading,
    error: error ?? null,
  };
}
