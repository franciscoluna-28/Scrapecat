"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/client";
import { queryKeys } from "./keys";
import type { EmbeddingProvider, ReportProvider } from "@/src/shared/constants";

export type AISettings = {
  reportProvider: ReportProvider;
  reportModel: string;
  embeddingProvider: EmbeddingProvider;
  embeddingModel: string;
};

export function useAISettings() {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.settings.ai,
    queryFn: () =>
      apiClient.GET("/api/v1/settings/ai").then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
  });

  return {
    settings: data,
    isLoading,
    error: error ?? null,
  };
}

export function useUpdateAISettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: AISettings) =>
      apiClient.PUT("/api/v1/settings/ai", { body }).then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.ai });
    },
  });
}
