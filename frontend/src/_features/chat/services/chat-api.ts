"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, API_URL, unwrap } from "@/src/shared/api/client";
import { queryKeys } from "@/src/shared/services/keys";
import { getAnonymousId } from "@/src/shared/lib/anonymous-id";
import { parseSseBuffer, parseSseFrame } from "@/src/shared/lib/sse";
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

/**
 * Streams an assistant reply over SSE via fetch. Calls `onChunk` for each frame;
 * resolves with the final assistant message.
 */
export async function streamChatMessage(
  sessionId: string,
  content: string,
  branch: string | null,
  onChunk: (chunk: StreamChunk) => void,
  model?: string,
  provider?: string,
  persona?: string,
): Promise<ChatMessage> {
  const res = await fetch(`${API_URL}/api/v1/chat/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-anonymous-id": getAnonymousId(),
    },
    body: JSON.stringify({
      content,
      ...(branch ? { branch } : {}),
      ...(model ? { model } : {}),
      ...(provider ? { provider } : {}),
      ...(persona ? { persona } : {}),
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Chat request failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneMessage: ChatMessage | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const { frames, rest } = parseSseBuffer(buffer);
    buffer = rest;

    for (const frame of frames) {
      const chunk = parseSseFrame(frame) as StreamChunk | null;
      if (!chunk) continue;
      if (chunk.type === "done") doneMessage = chunk.message;
      onChunk(chunk);
      if (chunk.type === "error") {
        return Promise.reject(new Error(chunk.error));
      }
    }
  }

  if (!doneMessage) {
    throw new Error("Stream ended without a completed reply");
  }
  return doneMessage;
}
