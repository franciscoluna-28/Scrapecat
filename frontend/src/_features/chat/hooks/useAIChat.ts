"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  streamChatMessage,
  useChatMessages,
  useCreateChatSession,
} from "@/src/_features/chat/services/chat-api";
import { queryKeys } from "@/src/shared/services/keys";
import { errorMessage } from "@/src/shared/api/client";
import { useChatModelStore } from "@/src/store/chat-model";
import { useChatPersonaStore } from "@/src/store/chat-persona";
import { useScrollContainer } from "@/src/components/global/ScrollContainer";
import type { ChatMessage } from "@/src/shared/types";
import {
  STREAMING_PREFIX,
  chatMessagesReducer,
  createChatMessagesState,
} from "./live-messages";
import { buildChatUrl } from "./chat-url";

type UseAIChatOptions = {
  projectId: string | null;
  sessionId: string | null;
  branch: string | null;
};

export function useAIChat({ projectId, sessionId, branch }: UseAIChatOptions) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const scrollContainerRef = useScrollContainer();
  const createSession = useCreateChatSession();
  const { provider: modelProvider, model: modelId } = useChatModelStore();
  const { persona } = useChatPersonaStore();

  const { messages: storedMessages, isLoading: messagesLoading } = useChatMessages(
    sessionId ?? undefined,
  );

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionKey = `${projectId ?? ""}:${sessionId ?? ""}`;
  const [liveState, dispatch] = useReducer(
    chatMessagesReducer,
    sessionKey,
    createChatMessagesState,
  );
  const forceScrollRef = useRef(false);

  // New sessions briefly have a `null` prop session while the URL catches up;
  // keep showing the live state we just keyed to the created session.
  const showLive =
    liveState.sessionKey === sessionKey ||
    (sessionId === null && liveState.sessionKey.startsWith(`${projectId ?? ""}:`));
  const liveMessages = useMemo(
    () => (showLive ? liveState.messages : []),
    [showLive, liveState.messages],
  );
  const ingestionProgress = showLive ? liveState.progress : null;

  const messages = useMemo(
    () => [...storedMessages, ...liveMessages],
    [storedMessages, liveMessages],
  );
  const streamingContentLength =
    liveMessages.find((m) => m.id.startsWith(STREAMING_PREFIX))?.content.length ?? 0;
  const streamingId =
    liveMessages.find((m) => m.id.startsWith(STREAMING_PREFIX))?.id ?? null;
  const isAwaitingResponse = isStreaming && streamingContentLength === 0;

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior) => {
      const container = scrollContainerRef.current;
      if (!container) return;
      if (typeof container.scrollTo === "function") {
        container.scrollTo({ top: container.scrollHeight, behavior });
      } else {
        container.scrollTop = container.scrollHeight;
      }
    },
    [scrollContainerRef],
  );

  useEffect(() => {
    forceScrollRef.current = true;
  }, [sessionKey]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distance =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    if (forceScrollRef.current || distance < 400) {
      const force = forceScrollRef.current;
      forceScrollRef.current = false;
      scrollToBottom(force ? "smooth" : "auto");
    }
  }, [messages.length, streamingContentLength, sessionKey, scrollToBottom, scrollContainerRef]);

  // Chat queries are keyed per project/session, so switching projects already
  // isolates history. Do not remove the shared sessions query here: it powers
  // the recent-chats list and removing it mid-flight can leave it loading.

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !projectId || isStreaming) return;

    setInput("");
    setIsStreaming(true);
    forceScrollRef.current = true;
    // Stable for this logical send so a retry replays instead of duplicating.
    const clientMessageId = crypto.randomUUID();

    let sid = sessionId;
    let isNewSession = false;

    try {
      if (!sid) {
        const created = await createSession.mutateAsync(projectId);
        sid = created.id;
        isNewSession = true;
      }
      const streamKey = `${projectId}:${sid}`;

      // Read the current URL (not the stale searchParams snapshot) and clear
      // any one-shot prompt while persisting the active project/session.
      const nextUrl = buildChatUrl(
        window.location.pathname,
        window.location.search,
        projectId,
        sid,
      );
      if (`${window.location.pathname}${window.location.search}` !== nextUrl) {
        router.replace(nextUrl, { scroll: false });
      }

      const userMsg: ChatMessage = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content: trimmed,
        branch,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      const draft: ChatMessage = {
        id: `${STREAMING_PREFIX}-${Date.now()}`,
        role: "assistant",
        content: "",
        branch,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      dispatch({
        type: "draft",
        sessionKey: streamKey,
        userMessage: userMsg,
        draft,
        includeUser: !isNewSession,
      });

      await streamChatMessage({
        sessionId: sid,
        content: trimmed,
        branch,
        model: modelId ?? undefined,
        provider: modelProvider ?? undefined,
        persona,
        clientMessageId,
        onChunk: (chunk) => {
          dispatch({
            type: "progress",
            sessionKey: streamKey,
            progress: chunk.type === "progress" ? chunk : null,
          });
          if (chunk.type === "token") {
            dispatch({ type: "token", sessionKey: streamKey, content: chunk.content });
          } else if (chunk.type === "done") {
            dispatch({ type: "done", sessionKey: streamKey, message: chunk.message });
          }
        },
      });

      dispatch({ type: "clear", sessionKey: streamKey });
      await queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(sid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessionsAll });
    } catch (error) {
      dispatch({ type: "error", sessionKey: `${projectId}:${sid ?? ""}` });
      toast.error(errorMessage(error, "Failed to send message"));
    } finally {
      setIsStreaming(false);
    }
  };

  return {
    messages,
    messagesLoading,
    streamingId,
    isStreaming,
    isAwaitingResponse,
    ingestionProgress,
    input,
    setInput,
    sendMessage,
  };
}
