import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/src/shared/types";
import { ApiError } from "@/src/shared/api/client";
import {
  ChatStreamError,
  consumeChatStream,
  streamChatMessage,
  type StreamChunk,
} from "./chat-api";

const finalMessage: ChatMessage = {
  id: "server-1",
  role: "assistant",
  content: "hello there",
  branch: null,
  citations: [],
  createdAt: "2024-01-01T00:00:00.000Z",
};

function frame(chunk: unknown): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("consumeChatStream", () => {
  it("emits tokens and resolves with the done message", async () => {
    const chunks: StreamChunk[] = [];
    const body = streamFrom([
      frame({ type: "token", content: "hel" }),
      frame({ type: "token", content: "lo" }),
      frame({ type: "done", message: finalMessage }),
    ]);

    const result = await consumeChatStream(body, (chunk) => chunks.push(chunk));

    expect(result).toEqual(finalMessage);
    expect(chunks).toEqual([
      { type: "token", content: "hel" },
      { type: "token", content: "lo" },
      { type: "done", message: finalMessage },
    ]);
  });

  it("reassembles frames split across reads", async () => {
    const chunks: StreamChunk[] = [];
    const body = streamFrom([
      'data: {"type":"tok',
      'en","content":"hi"}\n\n',
      frame({ type: "done", message: finalMessage }),
    ]);

    await consumeChatStream(body, (chunk) => chunks.push(chunk));

    expect(chunks[0]).toEqual({ type: "token", content: "hi" });
  });

  it("passes progress chunks through", async () => {
    const chunks: StreamChunk[] = [];
    const body = streamFrom([
      frame({ type: "progress", stage: "ingest", message: "working", done: 1, total: 3 }),
      frame({ type: "done", message: finalMessage }),
    ]);

    await consumeChatStream(body, (chunk) => chunks.push(chunk));

    expect(chunks[0]).toEqual({
      type: "progress",
      stage: "ingest",
      message: "working",
      done: 1,
      total: 3,
    });
  });

  it("throws a ChatStreamError on an error frame without emitting it", async () => {
    const chunks: StreamChunk[] = [];
    const body = streamFrom([
      frame({ type: "error", error: "boom", requestId: "req-1" }),
    ]);

    const error = await consumeChatStream(body, (chunk) => chunks.push(chunk)).catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(ChatStreamError);
    expect(error).toMatchObject({ message: "boom", requestId: "req-1" });
    expect(chunks).toEqual([]);
  });

  it("throws when the stream ends without a done frame", async () => {
    const body = streamFrom([frame({ type: "token", content: "hi" })]);

    await expect(consumeChatStream(body, () => {})).rejects.toThrow(
      "Stream ended without a completed reply",
    );
  });
});

describe("streamChatMessage", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("POSTs the typed body with a single auth header", async () => {
    fetchMock.mockResolvedValue(
      new Response(streamFrom([frame({ type: "done", message: finalMessage })]), {
        status: 200,
      }),
    );

    await streamChatMessage({
      sessionId: "session-1",
      content: "hi",
      branch: "main",
      model: "gpt",
      provider: "openrouter",
      persona: "cto",
      onChunk: () => {},
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:4000/api/v1/chat/sessions/session-1/messages");
    expect(init.method).toBe("POST");

    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("x-anonymous-id")).toBeTruthy();

    expect(JSON.parse(String(init.body))).toEqual({
      content: "hi",
      branch: "main",
      model: "gpt",
      provider: "openrouter",
      persona: "cto",
    });
  });

  it("omits unset optional fields", async () => {
    fetchMock.mockResolvedValue(
      new Response(streamFrom([frame({ type: "done", message: finalMessage })]), {
        status: 200,
      }),
    );

    await streamChatMessage({ sessionId: "session-1", content: "hi", onChunk: () => {} });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ content: "hi" });
  });

  it("normalizes non-OK responses into an ApiError", async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: "Bad request" }));

    const error = await streamChatMessage({
      sessionId: "session-1",
      content: "hi",
      onChunk: () => {},
    }).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ message: "Bad request", status: 400 });
  });

  it("falls back to the status when the error body is not JSON", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 502 }));

    await expect(
      streamChatMessage({ sessionId: "session-1", content: "hi", onChunk: () => {} }),
    ).rejects.toThrow("Request failed: 502");
  });
});
