"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  streamChatMessage,
  useChatMessages,
  useCreateChatSession,
  type StreamChunk,
} from "@/src/_features/chat/services/chat-api";
import { queryKeys } from "@/src/shared/services/keys";
import { useChatModelStore } from "@/src/store/chat-model";
import { useChatPersonaStore } from "@/src/store/chat-persona";
import type { ChatMessage } from "@/src/shared/types";
import {
  STREAMING_PREFIX,
  appendDraft,
  appendToken,
  replaceStreaming,
  removeStreaming,
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
  const createSession = useCreateChatSession();
  const { provider: modelProvider, model: modelId } = useChatModelStore();
  const { persona } = useChatPersonaStore();

  const { messages: storedMessages, isLoading: messagesLoading } = useChatMessages(
    sessionId ?? undefined,
  );

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [ingestionProgress, setIngestionProgress] = useState<StreamChunk & { type: "progress" } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const forceScrollRef = useRef(false);
  const sessionKey = `${projectId ?? ""}:${sessionId ?? ""}`;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveMessages([]);
    setIngestionProgress(null);
    forceScrollRef.current = true;
  }, [sessionKey]);

  const messages = useMemo(() => [...storedMessages, ...liveMessages], [storedMessages, liveMessages]);
  const streamingId = liveMessages.find((m) => m.id.startsWith(STREAMING_PREFIX))?.id ?? null;
  const streamingContentLength =
    liveMessages.find((m) => m.id.startsWith(STREAMING_PREFIX))?.content.length ?? 0;
  const isAwaitingResponse = isStreaming && streamingContentLength === 0;

  const scrollToBottom = useCallback((force: boolean) => {
    const container = bottomRef.current?.closest("[data-chat-scroll]") as HTMLElement | null;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: force ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    const el = bottomRef.current;
    const container = bottomRef.current?.closest("[data-chat-scroll]") as HTMLElement | null;
    if (!el || !container) return;
    const distance = container.getBoundingClientRect().bottom - el.getBoundingClientRect().bottom;
    if (forceScrollRef.current || distance < 400) {
      const force = forceScrollRef.current;
      forceScrollRef.current = false;
      scrollToBottom(force);
    }
  }, [messages.length, streamingContentLength, sessionKey, scrollToBottom]);

  // Project switching: clear all stale chat queries so old sessions don't bleed.
  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: queryKeys.chat.all });
    };
  }, [projectId, queryClient]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !projectId || isStreaming) return;
    setInput("");
    setIsStreaming(true);
    forceScrollRef.current = true;

    try {
      let sid = sessionId;
      let isNewSession = false;
      if (!sid) {
        const created = await createSession.mutateAsync(projectId);
        sid = created.id;
        isNewSession = true;
      }

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
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        branch,
        citations: [],
        createdAt: new Date().toISOString(),
      };
      setLiveMessages((m) => appendDraft(m, userMsg, draft, !isNewSession));
      requestAnimationFrame(() => scrollToBottom(true));

      await streamChatMessage(sid, trimmed, branch, (chunk) => {
        if (chunk.type === "progress") {
          setIngestionProgress(chunk);
        } else {
          setIngestionProgress(null);
        }
        if (chunk.type === "token") {
          setLiveMessages((m) => appendToken(m, chunk.content));
        } else if (chunk.type === "done") {
          setLiveMessages((m) => replaceStreaming(m, chunk.message));
        } else if (chunk.type === "error") {
          toast.error(chunk.error);
        }
      }, modelId ?? undefined, modelProvider ?? undefined, persona);

      setLiveMessages([]);
      setIngestionProgress(null);
      await queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(sid!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
    } catch {
      setIngestionProgress(null);
      setLiveMessages(removeStreaming);
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
    bottomRef,
  };
}
