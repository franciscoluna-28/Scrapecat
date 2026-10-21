"use client";

import {
  useQuery,
  useQueries,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient, unwrap } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import {
  AVAILABLE_PROVIDERS,
  type GitProviderId,
} from "@/src/shared/constants";
import type { GitProviderRepositoryItem } from "@/src/shared/types";

export type GitConnection = {
  connected: boolean;
  source: "token" | "env" | "none";
  login?: string;
};

type RepositoryQuery = {
  type: string;
  sort: string;
  direction: string;
  per_page: number;
};

function fetchGitConnection(provider: GitProviderId): Promise<GitConnection> {
  return unwrap(
    apiClient.GET("/api/v1/git-providers/{provider}/connection", {
      params: { path: { provider } },
    }),
  );
}

export function useGitConnection(provider: GitProviderId = "github") {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.gitConnections.connection(provider),
    queryFn: () => fetchGitConnection(provider),
  });

  return {
    connection: data ?? null,
    isLoading,
    error: error ?? null,
    refetch,
  };
}

/**
 * Connection state for every provider this build offers. Demo builds only
 * include GitHub, so GitLab is never queried there.
 */
export function useGitConnections() {
  const results = useQueries({
    queries: AVAILABLE_PROVIDERS.map((provider) => ({
      queryKey: queryKeys.gitConnections.connection(provider),
      queryFn: () => fetchGitConnection(provider),
    })),
  });

  const connections: Partial<Record<GitProviderId, GitConnection | null>> = {};
  AVAILABLE_PROVIDERS.forEach((provider, index) => {
    connections[provider] = results[index]?.data ?? null;
  });

  return {
    connections,
    connectedProviders: AVAILABLE_PROVIDERS.filter(
      (provider) => connections[provider]?.connected,
    ),
    isLoading: results.some((result) => result.isLoading),
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

async function fetchRepositories(
  filters: RepositoryQuery,
): Promise<GitProviderRepositoryItem[]> {
  const repositories = await unwrap(
    apiClient.GET("/api/v1/repositories", {
      params: { query: filters },
    }),
  );
  return repositories as GitProviderRepositoryItem[];
}

/**
 * Repository discovery for every provider the backend can read from. The
 * server owns provider selection (connected only, GitHub-only in demo) and
 * tags each repository with its host, so this stays a single request.
 */
export function useRepositoryFeed(filters: RepositoryQuery) {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.repositories.list(filters),
    queryFn: () => fetchRepositories(filters),
  });

  return {
    repositories: data ?? [],
    isLoading,
    isFetching,
    error: error ?? null,
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
