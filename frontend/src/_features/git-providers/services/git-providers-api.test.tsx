import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GitProviderRepositoryItem } from "@/src/shared/types";

const mocks = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
  DELETE: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/src/shared/api/client", () => ({
  apiClient: { GET: mocks.GET, POST: mocks.POST, DELETE: mocks.DELETE },
  unwrap: async (request: Promise<{ data?: unknown; error?: unknown }>) => {
    const result = await request;
    if (result.error) throw result.error;
    return result.data;
  },
  errorMessage: (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback,
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: vi.fn() },
}));

import {
  useBranches,
  useConnectGitProvider,
  useDisconnectGitProvider,
  useGitConnection,
  useGitConnections,
  useRepositoryFeed,
} from "./git-providers-api";

let queryClient: QueryClient;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function repo(
  overrides: Partial<GitProviderRepositoryItem> = {},
): GitProviderRepositoryItem {
  return {
    id: "1",
    provider: "github",
    name: "repo",
    full_name: "owner/repo",
    private: false,
    updated_at: "2024-01-01T00:00:00Z",
    owner: { login: "owner" },
    description: null,
    default_branch: "main",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.GET.mockReset();
  mocks.POST.mockReset();
  mocks.DELETE.mockReset();
  mocks.toastError.mockReset();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe("useGitConnection", () => {
  it("returns the connection payload for a provider", async () => {
    mocks.GET.mockResolvedValue({
      data: { connected: true, source: "token", login: "octocat" },
    });

    const { result } = renderHook(() => useGitConnection("github"), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(result.current.connection).toEqual({
        connected: true,
        source: "token",
        login: "octocat",
      }),
    );
    expect(mocks.GET).toHaveBeenCalledWith(
      "/api/v1/git-providers/{provider}/connection",
      { params: { path: { provider: "github" } } },
    );
  });

  it("aggregates only the connected providers", async () => {
    mocks.GET.mockImplementation(
      (_path: string, init?: { params?: { path?: { provider?: string } } }) =>
        Promise.resolve({
          data:
            init?.params?.path?.provider === "github"
              ? { connected: true, source: "token" }
              : { connected: false, source: "none" },
        }),
    );

    const { result } = renderHook(() => useGitConnections(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.connectedProviders).toEqual(["github"]);
  });
});

describe("useConnectGitProvider", () => {
  it("posts the token and invalidates connection and repository keys", async () => {
    mocks.POST.mockResolvedValue({
      data: { connected: true, source: "token", login: "octocat" },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useConnectGitProvider("gitlab"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync("glpat-token");
    });

    expect(mocks.POST).toHaveBeenCalledWith(
      "/api/v1/git-providers/{provider}/connection",
      { params: { path: { provider: "gitlab" } }, body: { token: "glpat-token" } },
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["git-connections"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["repositories"] });
  });

  it("surfaces the normalized error through a toast", async () => {
    mocks.POST.mockRejectedValue(new Error("bad token"));

    const { result } = renderHook(() => useConnectGitProvider("github"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(result.current.mutateAsync("nope")).rejects.toThrow(
        "bad token",
      );
    });

    expect(mocks.toastError).toHaveBeenCalledWith("bad token");
  });
});

describe("useDisconnectGitProvider", () => {
  it("deletes the connection and invalidates both feeds", async () => {
    mocks.DELETE.mockResolvedValue({ data: undefined });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useDisconnectGitProvider("github"), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(mocks.DELETE).toHaveBeenCalledWith(
      "/api/v1/git-providers/{provider}/connection",
      { params: { path: { provider: "github" } } },
    );
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["git-connections"],
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["repositories"] });
  });
});

describe("useRepositoryFeed", () => {
  it("returns repositories for the requested filters", async () => {
    const filters = {
      type: "all",
      sort: "updated",
      direction: "desc",
      per_page: 50,
    };
    mocks.GET.mockResolvedValue({ data: [repo()] });

    const { result } = renderHook(() => useRepositoryFeed(filters), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.repositories).toEqual([repo()]));
    expect(mocks.GET).toHaveBeenCalledWith("/api/v1/repositories", {
      params: { query: filters },
    });
  });
});

describe("useBranches", () => {
  it("returns branches and the resolved default", async () => {
    mocks.GET.mockResolvedValue({
      data: { branches: ["main", "dev"], defaultBranch: "main" },
    });

    const { result } = renderHook(() => useBranches("owner", "repo", "gitlab"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.branches).toEqual(["main", "dev"]));
    expect(result.current.defaultBranch).toBe("main");
    expect(mocks.GET).toHaveBeenCalledWith(
      "/api/v1/repositories/{owner}/{repo}/branches",
      {
        params: {
          path: { owner: "owner", repo: "repo" },
          query: { provider: "gitlab" },
        },
      },
    );
  });
});
