"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  apiClient,
  API_URL,
  ApiError,
  apiErrorFromResponse,
  authHeaders,
  unwrap,
} from "@/src/shared/api/client";
import type { paths } from "@/src/shared/api/types";
import { queryKeys } from "@/src/shared/services/keys";
import { parseSseBuffer, parseSseFrame } from "@/src/shared/lib/sse";
import type { Persona } from "@/src/shared/constants";
import type { ChatMessage } from "@/src/shared/types";

export async function prepareProjectBranch(projectId: string, branch: string) {
  return unwrap(
    apiClient.POST("/api/v1/projects/{id}/branches/prepare", {
      params: { path: { id: projectId } },
      body: { branch },
    }),
  );
}

export function usePrepareProjectBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, branch }: { projectId: string; branch: string }) =>
      prepareProjectBranch(projectId, branch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.list });
    },
  });
}

export function useChatSessions(projectId?: string) {
  const query = projectId ? { projectId } : undefined;
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.chat.sessions(projectId),
    queryFn: () =>
      unwrap(apiClient.GET("/api/v1/chat/sessions", { params: { query } })),
    enabled: !!projectId,
  });

  return {
    sessions: data?.sessions ?? [],
    isLoading,
    isFetching,
    error: error ?? null,
  };
}

export function useChatMessages(sessionId?: string) {
  const { data, error, isLoading, isFetching } = useQuery({
    queryKey: queryKeys.chat.messages(sessionId!),
    queryFn: () =>
      unwrap(
        apiClient.GET("/api/v1/chat/sessions/{id}/messages", {
          params: { path: { id: sessionId! } },
        }),
      ),
    enabled: !!sessionId,
  });

  return {
    messages: data?.messages ?? [],
    isLoading,
    isFetching,
    error: error ?? null,
  };
}

export function useCreateChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) =>
      unwrap(apiClient.POST("/api/v1/chat/sessions", { body: { projectId } })),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(session.projectId) });
    },
  });
}

export function useDeleteChatSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) =>
      unwrap(
        apiClient.DELETE("/api/v1/chat/sessions/{id}", {
          params: { path: { id: sessionId } },
        }),
      ),
    onSuccess: (_data, sessionId) => {
      queryClient.removeQueries({ queryKey: queryKeys.chat.messages(sessionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
    },
  });
}

export type StreamChunk =
  | { type: "token"; content: string }
  | { type: "done"; message: ChatMessage }
  | { type: "error"; error: string; requestId?: string }
  | { type: "progress"; stage: string; message: string; done?: number; total?: number };

export type ProgressChunk = Extract<StreamChunk, { type: "progress" }>;

/** Raised for both transport failures and in-stream `error` frames. */
export class ChatStreamError extends ApiError {
  constructor(message: string, requestId?: string) {
    super(message, { requestId });
    this.name = "ChatStreamError";
  }
}

type SendMessageBody = NonNullable<
  paths["/api/v1/chat/sessions/{id}/messages"]["post"]
>["requestBody"]["content"]["application/json"];

export type SendChatMessageInput = {
  sessionId: string;
  content: string;
  branch?: string | null;
  model?: string;
  provider?: string;
  persona?: Persona;
  onChunk: (chunk: StreamChunk) => void;
};

/**
 * Streams an assistant reply over SSE. Calls `onChunk` for each token/progress
 * frame and resolves with the final assistant message. Transport and in-stream
 * failures reject with a `ChatStreamError`.
 */
export async function streamChatMessage({
  sessionId,
  content,
  branch,
  model,
  provider,
  persona,
  onChunk,
}: SendChatMessageInput): Promise<ChatMessage> {
  const body: SendMessageBody = {
    content,
    ...(branch ? { branch } : {}),
    ...(model ? { model } : {}),
    ...(provider ? { provider } : {}),
    ...(persona ? { persona } : {}),
  };

  const res = await fetch(`${API_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw await apiErrorFromResponse(res);
  }
  if (!res.body) {
    throw new ChatStreamError("Chat stream unavailable");
  }

  return consumeChatStream(res.body, onChunk);
}

/** Parses an SSE body, emitting chunks until the `done` frame is received. */
export async function consumeChatStream(
  body: ReadableStream<Uint8Array>,
  onChunk: (chunk: StreamChunk) => void,
): Promise<ChatMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneMessage: ChatMessage | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const { frames, rest } = parseSseBuffer(buffer);
      buffer = rest;

      for (const frame of frames) {
        const chunk = parseSseFrame(frame) as StreamChunk | null;
        if (!chunk) continue;
        if (chunk.type === "error") {
          throw new ChatStreamError(chunk.error, chunk.requestId);
        }
        if (chunk.type === "done") doneMessage = chunk.message;
        onChunk(chunk);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!doneMessage) {
    throw new ChatStreamError("Stream ended without a completed reply");
  }
  return doneMessage;
}
