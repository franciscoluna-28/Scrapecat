"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, unwrap } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";

export function useCredentials() {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.credentials.all,
    queryFn: () => unwrap(apiClient.GET("/api/v1/credentials")),
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
    mutationFn: (body: { provider: string; key: string }) =>
      unwrap(apiClient.POST("/api/v1/credentials", { body })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.credentials.all });
    },
  });
}

export function useVerifyCredential() {
  return useMutation({
    mutationFn: (body: { provider: string; key: string }) =>
      unwrap(apiClient.POST("/api/v1/credentials/verify", { body })),
  });
}
