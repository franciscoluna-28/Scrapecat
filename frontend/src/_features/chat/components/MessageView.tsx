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
import { ChatMessage } from "@/src/shared/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/src/components/ui/collapsible";
import { CommitCitationCard } from "./CommitCitationCard";
import { cn } from "@/src/shared/lib/utils";
import { splitArtifact } from "@/src/shared/utils/repo-url";

export function MessageView({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming?: boolean;
}) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const citationCount = message.citations.length;
  const { before, artifact } = message.role === "assistant" ? splitArtifact(message.content) : { before: message.content, artifact: null };

  return (
    <Message from={message.role}>
      <MessageContent>
        {message.role === "assistant" ? (
          <>
            {before && (
              <MessageResponse>{before}</MessageResponse>
            )}
            {artifact && (
              <div className="rounded-lg border bg-card p-6 my-3 space-y-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 font-semibold">
                    Report
                  </span>
                </div>
                <MessageResponse className="m-6">{artifact}</MessageResponse>
              </div>
            )}
            {streaming && (
              <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-foreground/70 align-middle" />
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
              const cleaned = message.content.replace(/:::report\n?|:::/g, "").trim();
              navigator.clipboard.writeText(cleaned);
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