"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Copy } from "lucide-react";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from "@/src/components/ai-elements/message";
import { Spinner } from "@/src/components/ui/spinner";
import { ChatMessage } from "@/src/shared/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/components/ui/collapsible";
import { CommitCitationCard } from "./CommitCitationCard";
import { cn } from "@/src/shared/lib/utils";

export function MessageView({
  message,
  streaming,
  awaitingResponse,
}: {
  message: ChatMessage;
  streaming?: boolean;
  awaitingResponse?: boolean;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const citationCount = message.citations.length;

  return (
    <Message from={message.role}>
      <MessageContent>
        {message.role === "assistant" ? (
          <>
            {message.content && (
              <MessageResponse>{message.content}</MessageResponse>
            )}
            {awaitingResponse ? (
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                Thinking…
              </span>
            ) : (
              streaming && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/70 align-middle" />
              )
            )}
          </>
        ) : (
          <p className="whitespace-pre-wrap">{message.content}</p>
        )}
      </MessageContent>
      {message.role === "assistant" && (
        <MessageActions>
          <MessageAction
            tooltip="Copy"
            onClick={() => {
              navigator.clipboard.writeText(message.content.trim());
              toast.success("Copied to clipboard");
            }}
          >
            <Copy className="size-3.5" />
          </MessageAction>
        </MessageActions>
      )}
      {message.role === "assistant" && citationCount > 0 && (
        <Collapsible
          defaultOpen={false}
          onOpenChange={setSourcesOpen}
          className="w-full pt-3 mt-2"
        >
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between rounded-md py-1.5 cursor-pointer transition-colors">
              <span className="text-[11px] font-medium text-muted-foreground">
                Sources Used · {message.branch ?? "all branches"} ({citationCount}{" "}
                {citationCount === 1 ? "commit retrieved" : "commits retrieved"})
              </span>
              <ChevronDown
                className={cn(
                  "size-3.5 text-muted-foreground transition-transform",
                  sourcesOpen && "rotate-180",
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-1 pt-2">
            {message.citations.map((c) => (
              <CommitCitationCard key={c.commitSha} citation={c} />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </Message>
  );
}