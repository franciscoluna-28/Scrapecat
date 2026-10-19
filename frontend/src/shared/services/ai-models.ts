"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, unwrap } from "../api/client";
import { queryKeys } from "./keys";
import type { AIModel } from "@/src/shared/types";

export type { AIModel };

export function useModels(provider?: string, modality?: "chat" | "embeddings") {
  const query = { provider, modality };

  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.models.list(provider, modality),
    queryFn: () => unwrap(apiClient.GET("/api/v1/models", { params: { query } })),
  });

  return {
    models: data?.models ?? [],
    isLoading,
    error: error ?? null,
  };
}

export function useAllModels() {
  return useModels(undefined, "chat");
}
