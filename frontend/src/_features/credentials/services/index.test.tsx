import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  GET: vi.fn(),
  POST: vi.fn(),
}));

vi.mock("@/src/shared/api/client", () => ({
  apiClient: { GET: mocks.GET, POST: mocks.POST },
  unwrap: async (request: Promise<{ data?: unknown; error?: unknown }>) => {
    const result = await request;
    if (result.error) throw result.error;
    return result.data;
  },
}));

import {
  useAddCredential,
  useCredentials,
  useVerifyCredential,
} from "./index";

let queryClient: QueryClient;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const credential = {
  id: "credential-1",
  provider: "openai",
  keyHint: "sk-1••••••••7890",
  createdAt: "2024-01-01T00:00:00.000Z",
};

beforeEach(() => {
  mocks.GET.mockReset();
  mocks.POST.mockReset();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe("useCredentials", () => {
  it("returns the safe credential list", async () => {
    mocks.GET.mockResolvedValue({ data: { keys: [credential] } });

    const { result } = renderHook(() => useCredentials(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.credentials).toEqual([credential]));
    expect(mocks.GET).toHaveBeenCalledWith("/api/v1/credentials");
  });
});

describe("useAddCredential", () => {
  it("posts the key and invalidates the credential list", async () => {
    mocks.POST.mockResolvedValue({ data: { id: credential.id } });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAddCredential(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        provider: "openai",
        key: "sk-1234567890",
      });
    });

    expect(mocks.POST).toHaveBeenCalledWith("/api/v1/credentials", {
      body: { provider: "openai", key: "sk-1234567890" },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["credentials"] });
  });

  it("rejects with the normalized error", async () => {
    mocks.POST.mockRejectedValue(new Error("invalid key"));

    const { result } = renderHook(() => useAddCredential(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ provider: "openai", key: "bad" }),
      ).rejects.toThrow("invalid key");
    });
  });
});

describe("useVerifyCredential", () => {
  it("posts the key to the verify endpoint", async () => {
    mocks.POST.mockResolvedValue({ data: { valid: true } });

    const { result } = renderHook(() => useVerifyCredential(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current.mutateAsync({
        provider: "openrouter",
        key: "sk-test",
      });
    });

    expect(mocks.POST).toHaveBeenCalledWith("/api/v1/credentials/verify", {
      body: { provider: "openrouter", key: "sk-test" },
    });
  });
});
