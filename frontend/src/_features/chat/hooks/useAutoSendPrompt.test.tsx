import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useAutoSendPrompt } from "./useAutoSendPrompt";

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.searchParams,
}));

const baseProps = {
  projectId: "p1" as string | null,
  isStreaming: false,
  messagesLoading: false,
  sendMessage: vi.fn(),
};

function renderAutoSend(overrides: Partial<typeof baseProps> = {}) {
  const props = { ...baseProps, ...overrides };
  return {
    props,
    ...renderHook(() => useAutoSendPrompt(props)),
  };
}

beforeEach(() => {
  mocks.searchParams = new URLSearchParams();
  baseProps.sendMessage.mockReset();
});

describe("useAutoSendPrompt", () => {
  it("sends the q prompt once the chat is ready", async () => {
    mocks.searchParams = new URLSearchParams("q=what+shipped");
    const sendMessage = vi.fn();
    renderAutoSend({ sendMessage });

    await waitFor(() => {
      expect(sendMessage).toHaveBeenCalledWith("what shipped");
    });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a prompt", () => {
    const sendMessage = vi.fn();
    renderAutoSend({ sendMessage });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("does nothing without an active project", () => {
    mocks.searchParams = new URLSearchParams("q=hello");
    const sendMessage = vi.fn();
    renderAutoSend({ sendMessage, projectId: null });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("waits for messages to finish loading", () => {
    mocks.searchParams = new URLSearchParams("q=hello");
    const sendMessage = vi.fn();
    const { rerender } = renderHook(
      (props: typeof baseProps) => useAutoSendPrompt(props),
      { initialProps: { ...baseProps, sendMessage, messagesLoading: true } },
    );
    expect(sendMessage).not.toHaveBeenCalled();

    rerender({ ...baseProps, sendMessage, messagesLoading: false });
    return waitFor(() => expect(sendMessage).toHaveBeenCalledWith("hello"));
  });

  it("does not resend the same prompt on re-render", async () => {
    mocks.searchParams = new URLSearchParams("q=hello");
    const sendMessage = vi.fn();
    const { rerender } = renderHook(
      (props: typeof baseProps) => useAutoSendPrompt(props),
      { initialProps: { ...baseProps, sendMessage } },
    );

    await waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(1));
    rerender({ ...baseProps, sendMessage });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});
