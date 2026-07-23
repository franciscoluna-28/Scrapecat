"use client";

import useSWR from "swr";
import type { paths } from "../api/types";

type ModelsData = paths["/api/models"]["get"]["responses"][200]["content"]["application/json"];

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export function useModels() {
  const { data, error, isLoading } = useSWR<ModelsData>(`${API_URL}/api/models`);

  return {
    models: data?.models ?? [],
    isLoading,
    error: error ?? null,
  };
}
