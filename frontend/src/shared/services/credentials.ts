"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "./keys";

export function useCredentials() {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.credentials.all,
    queryFn: () =>
      apiClient.GET("/api/v1/credentials").then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
  });

  return {
    credentials: data?.keys ?? [],
    isLoading,
    error: error ?? null,
  };
}

export function useAddCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: { provider: string; key: string; name?: string }) =>
      apiClient.POST("/api/v1/credentials", { body }).then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all });
    },
  });
}

export function useDeleteCredential() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiClient.DELETE("/api/v1/credentials/{id}", { params: { path: { id } } }).then((r) => {
        if (r.error) throw r.error;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all });
    },
  });
}

export function useVerifyCredential() {
  return useMutation({
    mutationFn: (body: { provider: string; key: string }) =>
      apiClient.POST("/api/v1/credentials/verify", { body }).then((r) => {
        if (r.error) throw r.error;
        return r.data;
      }),
  });
}
