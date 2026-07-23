"use client";

import useSWR from "swr";

export interface ModelInfo {
  id: string;
  name: string;
  free: boolean;
  description: string;
}

interface UseModelsReturn {
  models: ModelInfo[];
  isLoading: boolean;
  error: Error | null;
}

export function useModels(): UseModelsReturn {
  const { data, error, isLoading } = useSWR<{ models: ModelInfo[] }>(
    "/api/ai/models",
  );

  return {
    models: data?.models ?? [],
    isLoading,
    error: error ?? null,
  };
}
