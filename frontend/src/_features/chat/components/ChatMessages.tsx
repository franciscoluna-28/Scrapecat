"use client";

import type { Ref } from "react";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Progress } from "@/src/components/ui/progress";
import { Spinner } from "@/src/components/ui/spinner";
import { ConversationEmptyState } from "@/src/components/ai-elements/conversation";
import { BookOpen, GitCommitHorizontal, Database, Zap } from "lucide-react";
import type { ChatMessage } from "@/src/shared/types";
import { MessageView } from "./MessageView";

type IngestionProgress = {
  stage: string;
  message: string;
  done?: number;
  total?: number;
};

type ChatMessagesProps = {
  messages: ChatMessage[];
  streamingId: string | null;
  isLoading: boolean;
  sessionId: string | null;
  projectName: string | null;
  ingestionProgress: IngestionProgress | null;
  bottomRef: Ref<HTMLDivElement>;
};

const stageIcon: Record<string, React.ReactNode> = {
  archive: <GitCommitHorizontal className="size-3.5" />,
  commits: <Database className="size-3.5" />,
  ingest: <Database className="size-3.5" />,
  embedding: <Zap className="size-3.5" />,
};

export function ChatMessages({
  messages,
  streamingId,
  isLoading,
  sessionId,
  projectName,
  ingestionProgress,
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
        {ingestionProgress && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-xs text-muted-foreground animate-pulse">
            <Spinner className="size-3.5" />
            {stageIcon[ingestionProgress.stage] ?? null}
            <span className="flex-1 truncate">{ingestionProgress.message}</span>
            {ingestionProgress.done != null && ingestionProgress.total != null && (
              <Progress
                className="w-20 h-1"
                value={(ingestionProgress.done / ingestionProgress.total) * 100}
              />
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
