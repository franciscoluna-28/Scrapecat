import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/src/shared/types";
import { ScrollContainerProvider } from "@/src/components/global/ScrollContainer";
import { useAIChat } from "./useAIChat";

const mocks = vi.hoisted(() => ({
  streamChatMessage: vi.fn(),
  createSession: vi.fn(),
  storedMessages: [] as ChatMessage[],
}));

vi.mock("../services/chat-api", () => ({
  streamChatMessage: mocks.streamChatMessage,
  useCreateChatSession: () => ({ mutateAsync: mocks.createSession }),
  useChatMessages: () => ({ messages: mocks.storedMessages, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const finalMessage: ChatMessage = {
  id: "server-1",
  role: "assistant",
  content: "hello there",
  branch: null,
  citations: [],
  createdAt: "2024-01-01T00:00:00.000Z",
};

let queryClient: QueryClient;

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ScrollContainerProvider>{children}</ScrollContainerProvider>
      </QueryClientProvider>
    );
  };
}

beforeEach(() => {
  mocks.streamChatMessage.mockReset();
  mocks.createSession.mockReset();
  mocks.storedMessages = [];
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe("useAIChat", () => {
  it("creates a session, streams, and invalidates the narrow keys", async () => {
    mocks.createSession.mockResolvedValue({ id: "session-1" });
    mocks.streamChatMessage.mockResolvedValue(finalMessage);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(
      () => useAIChat({ projectId: "project-1", sessionId: null, branch: null }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.sendMessage("  hello  ");
    });

    expect(mocks.createSession).toHaveBeenCalledWith("project-1");
    expect(mocks.streamChatMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: "session-1",
        content: "hello",
        branch: null,
      }),
    );

    const keys = invalidate.mock.calls
      .map((call) => call[0]?.queryKey)
      .filter((key) => key !== undefined);
    expect(keys).toContainEqual(["chat", "messages", "session-1"]);
    expect(keys).toContainEqual(["chat", "sessions", { projectId: "project-1" }]);
    expect(keys).not.toContainEqual(["chat"]);
  });

  it("surfaces transport errors through toast and drops the draft", async () => {
    mocks.streamChatMessage.mockRejectedValue(new Error("stream failed"));
    const { toast } = await import("sonner");

    const { result } = renderHook(
      () => useAIChat({ projectId: "project-1", sessionId: "session-1", branch: null }),
      { wrapper: createWrapper() },
    );

    await act(async () => {
      await result.current.sendMessage("hello");
    });

    expect(toast.error).toHaveBeenCalledWith("stream failed");
    await waitFor(() => expect(result.current.isStreaming).toBe(false));
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].role).toBe("user");
  });

  it("renders a token chunk into the live message", async () => {
    let emit: ((chunk: { type: "token"; content: string }) => void) | undefined;
    let resolveStream: ((message: ChatMessage) => void) | undefined;

    mocks.streamChatMessage.mockImplementation(
      ({ onChunk }: { onChunk: (chunk: { type: "token"; content: string }) => void }) => {
        emit = onChunk;
        return new Promise<ChatMessage>((resolve) => {
          resolveStream = resolve;
        });
      },
    );

    const { result } = renderHook(
      () => useAIChat({ projectId: "project-1", sessionId: "session-1", branch: null }),
      { wrapper: createWrapper() },
    );

    act(() => {
      void result.current.sendMessage("hello");
    });

    act(() => {
      emit?.({ type: "token", content: "hi" });
    });

    await waitFor(() =>
      expect(result.current.messages.some((m) => m.content === "hi")).toBe(true),
    );

    await act(async () => {
      resolveStream?.(finalMessage);
    });
  });
});
