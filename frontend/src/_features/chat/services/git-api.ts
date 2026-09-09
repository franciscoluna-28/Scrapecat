"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";

export const GITHUB_PAT_URL =
  "https://github.com/settings/tokens/new?description=Scrapecat&scopes=repo,read:user";

export type GitHubConnection = {
  connected: boolean;
  source: "token" | "env" | "none";
  login?: string;
};

export function useGitHubConnection() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.github.connection,
    queryFn: () =>
      apiClient
        .GET("/api/v1/github/connection")
        .then((r) => {
          if (r.error) throw r.error;
          return r.data as GitHubConnection;
        }),
  });

  return {
    connection: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
  };
}

export function useConnectGitHubToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const res = await apiClient.POST("/api/v1/github/token", {
        body: { token },
      });
      if (res.error || !res.data) {
        throw new Error((res.error as { error?: string })?.error ?? "Failed to connect GitHub");
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.github.connection });
      queryClient.invalidateQueries({ queryKey: ["repositories"] });
    },
  });
}

export function useDisconnectGitHub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await apiClient.DELETE("/api/v1/github/connection");
      if (res.error) throw new Error("Failed to disconnect GitHub");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.github.connection });
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
  type: string;
  sort: string;
  direction: string;
  per_page: number;
}) {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.repositories.list(filters),
    queryFn: () =>
      apiClient
        .GET("/api/v1/repositories", {
          params: {
            query: {
              type: filters.type,
              sort: filters.sort,
              direction: filters.direction,
              per_page: filters.per_page,
            },
          },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
  });

  return {
    repositories: data ?? [],
    isLoading,
    isValidating: isFetching,
    isFetching,
    error: error ?? null,
    hasError: !!error,
  };
}

export function useBranches(owner: string, repo: string) {
  const { data, error, isLoading } = useQuery({
    queryKey: queryKeys.branches.list(owner, repo),
    queryFn: () =>
      apiClient
        .GET("/api/v1/repositories/{owner}/{repo}/branches", {
          params: { path: { owner, repo } },
        })
        .then((r) => {
          if (r.error) throw r.error;
          return r.data;
        }),
    enabled: !!owner && !!repo,
  });

  return {
    branches: data?.branches ?? [],
    defaultBranch: data?.defaultBranch ?? null,
    isLoading,
    error: error ?? null,
  };
}