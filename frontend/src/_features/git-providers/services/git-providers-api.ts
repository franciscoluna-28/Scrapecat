"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, unwrap } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import type { GitProviderId } from "@/src/shared/constants";
import type { GitProviderRepository } from "@/src/shared/types";

export type GitConnection = {
  connected: boolean;
  source: "token" | "env" | "none";
  login?: string;
};

export function useGitConnection(provider: GitProviderId = "github") {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.gitConnections.connection(provider),
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/git-providers/{provider}/connection", {
          params: { path: { provider } },
        }),
      ),
  });

  return {
    connection: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
  };
}

export function useConnectGitProvider(provider: GitProviderId = "github") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await apiClient.POST(
        "/api/v1/git-providers/{provider}/connection",
        {
          params: { path: { provider } },
          body: { token },
        },
      );
      if (res.error || !res.data) {
        throw new Error(
          (res.error as { error?: string })?.error ??
            "Failed to connect git provider",
        );
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.gitConnections.all,
      });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

export function useDisconnectGitProvider(provider: GitProviderId = "github") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.DELETE(
        "/api/v1/git-providers/{provider}/connection",
        { params: { path: { provider } } },
      );
      if (res.error) throw new Error("Failed to disconnect git provider");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.gitConnections.all,
      });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

export type RepoCommit = {
  sha: string;
  message: string;
  author: string;
  date: string;
  url?: string;
};

export function useRepositories(filters: {
  provider?: GitProviderId;
  type: string;
  sort: string;
  direction: string;
  per_page: number;
}) {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.repositories.list(filters),
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/repositories", {
          params: {
            query: {
              provider: filters.provider,
              type: filters.type,
              sort: filters.sort,
              direction: filters.direction,
              per_page: filters.per_page,
            },
          },
        }),
      ),
  });

  return {
    repositories: (data ?? []) as GitProviderRepository[],
    isLoading,
    isValidating: isFetching,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}

export function useBranches(
  owner: string,
  repo: string,
  provider?: GitProviderId,
) {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.branches.list(owner, repo, provider),
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/repositories/{owner}/{repo}/branches", {
          params: { path: { owner, repo }, query: { provider } },
        }),
      ),
    enabled: !!owner && !!repo,
  });

  return {
    branches: data?.branches ?? [],
    defaultBranch: data?.defaultBranch ?? null,
    isLoading,
    error: error ?? null,
  };
}
