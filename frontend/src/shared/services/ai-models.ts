"use client";

import useSWR from "swr";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
    `${API_URL}/api/ai/models`,
  );

  return {
    models: data?.models ?? [],
    isLoading,
    error: error ?? null,
  };
}
