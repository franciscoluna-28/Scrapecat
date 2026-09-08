"use client";

import type { Ref } from "react";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ConversationEmptyState } from "@/src/components/ai-elements/conversation";
import { BookOpen } from "lucide-react";
import type { ChatMessage } from "@/src/shared/types";
import { MessageView } from "./MessageView";

type ChatMessagesProps = {
  messages: ChatMessage[];
  streamingId: string | null;
  isLoading: boolean;
  sessionId: string | null;
  projectName: string | null;
  bottomRef: Ref<HTMLDivElement>;
};

export function ChatMessages({
  messages,
  streamingId,
  isLoading,
  sessionId,
  projectName,
  bottomRef,
}: ChatMessagesProps) {
  if (isLoading && sessionId && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-[800px] space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-2/3" />
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <ConversationEmptyState
        className="flex-1"
        icon={<BookOpen className="size-12" />}
        title={`Ask about ${projectName}`}
        description="For example, when was the RAG chat added, or what shipped this week."
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center px-4 py-4">
      <div className="max-w-[800px] mx-auto w-full space-y-2">
        {messages.map((m) => (
          <MessageView key={m.id} message={m} streaming={m.id === streamingId} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
