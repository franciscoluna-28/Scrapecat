"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  streamChatMessage,
  useChatMessages,
  useCreateChatSession,
} from "@/src/_features/chat/services/chat-api";
import { queryKeys } from "@/src/shared/services/keys";
import type { ChatMessage } from "@/src/shared/types";

const STREAMING_PREFIX = "local-assistant";

type UseAIChatOptions = {
  projectId: string | null;
  sessionId: string | null;
  branch: string | null;
};

export function useAIChat({ projectId, sessionId, branch }: UseAIChatOptions) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const createSession = useCreateChatSession();

  const { messages: storedMessages, isLoading: messagesLoading } = useChatMessages(
    sessionId ?? undefined,
  );

  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const forceScrollRef = useRef(false);

  const messages = useMemo(() => [...storedMessages, ...liveMessages], [storedMessages, liveMessages]);
  const streamingId = liveMessages.find((m) => m.id.startsWith(STREAMING_PREFIX))?.id ?? null;
  const streamingContentLength =
    liveMessages.find((m) => m.id.startsWith(STREAMING_PREFIX))?.content.length ?? 0;

  const scrollToBottom = useCallback((force: boolean) => {
    const container = bottomRef.current?.closest("[data-chat-scroll]") as HTMLElement | null;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: force ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    forceScrollRef.current = true;
  }, [sessionId]);

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
  }, [messages.length, streamingContentLength, scrollToBottom]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !projectId || isStreaming) return;
    setInput("");
    setIsStreaming(true);
    forceScrollRef.current = true;

    try {
      let sid = sessionId;
      if (!sid) {
        const created = await createSession.mutateAsync(projectId);
        sid = created.id;
        const p = new URLSearchParams(searchParams.toString());
        p.set("session", sid);
        router.replace(`/app?${p.toString()}`, { scroll: false });
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
      setLiveMessages((m) => [...m, userMsg, draft]);
      requestAnimationFrame(() => scrollToBottom(true));

      await streamChatMessage(sid, trimmed, branch, (chunk) => {
        if (chunk.type === "token") {
          setLiveMessages((m) => {
            const copy = [...m];
            const idx = copy.findIndex((msg) => msg.id.startsWith(STREAMING_PREFIX));
            if (idx >= 0) copy[idx] = { ...copy[idx], content: copy[idx].content + chunk.content };
            return copy;
          });
        } else if (chunk.type === "done") {
          setLiveMessages((m) => {
            const copy = [...m];
            const idx = copy.findIndex((msg) => msg.id.startsWith(STREAMING_PREFIX));
            if (idx >= 0) copy[idx] = { ...chunk.message };
            return copy;
          });
        } else if (chunk.type === "error") {
          toast.error(chunk.error);
        }
      });

      await queryClient.invalidateQueries({ queryKey: queryKeys.chat.messages(sid) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.sessions(projectId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
      setLiveMessages([]);
    } catch {
      setLiveMessages((m) => m.filter((msg) => !msg.id.startsWith(STREAMING_PREFIX)));
    } finally {
      setIsStreaming(false);
    }
  };

  return {
    messages,
    messagesLoading,
    streamingId,
    isStreaming,
    input,
    setInput,
    sendMessage,
    bottomRef,
  };
}
