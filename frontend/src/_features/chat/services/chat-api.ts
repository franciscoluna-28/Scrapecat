"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/src/shared/api/client";
import type { ChatAskBody, ChatAskResponse } from "@/src/shared/types";

export function useChatAsk() {
  return useMutation<ChatAskResponse, Error, ChatAskBody>({
    mutationFn: async (body) => {
      const { data, error } = await apiClient.POST("/api/v1/chat/ask", { body });
      if (error || !data) {
        const message =
          (error as { error?: string } | null)?.error ?? "Failed to get an answer";
        throw new Error(message);
      }
      return data;
    },
  });
}
