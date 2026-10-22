"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { useSearchParams } from "next/navigation";

type Options = {
  projectId: string | null;
  isStreaming: boolean;
  messagesLoading: boolean;
  sendMessage: (text: string) => void;
};

/**
 * Demo links can carry a `q` param. Send it once the chat is ready; the URL
 * cleanup happens in `useAIChat` when the session is created/updated.
 */
export function useAutoSendPrompt({
  projectId,
  isStreaming,
  messagesLoading,
  sendMessage,
}: Options) {
  const searchParams = useSearchParams();
  const prompt = searchParams.get("q");
  const sentRef = useRef<string | null>(null);
  const send = useEffectEvent(sendMessage);

  useEffect(() => {
    if (!projectId || !prompt || isStreaming || messagesLoading) return;
    if (sentRef.current === prompt) return;
    sentRef.current = prompt;
    send(prompt);
  }, [projectId, prompt, isStreaming, messagesLoading]);
}
