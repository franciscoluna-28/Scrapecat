import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/src/shared/api/client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/src/shared/api/client")>();
  return {
    ...actual,
    apiClient: { ...actual.apiClient, GET: mocks.get },
    unwrap: (value: unknown) => value,
  };
});

import { useRecentChatSessions } from "./chat-api";

let queryClient: QueryClient;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useRecentChatSessions", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("lists sessions across every project", async () => {
    mocks.get.mockResolvedValue({
      sessions: [
        {
          id: "session-1",
          projectId: "project-1",
          title: "What shipped?",
          createdAt: "2026-11-01T10:00:00.000Z",
          updatedAt: "2026-11-02T10:00:00.000Z",
        },
      ],
    });

    const { result } = renderHook(() => useRecentChatSessions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.sessions).toHaveLength(1));

    expect(mocks.get).toHaveBeenCalledWith("/api/v1/chat/sessions");
    expect(result.current.sessions[0]).toMatchObject({
      id: "session-1",
      projectId: "project-1",
    });
  });
});
