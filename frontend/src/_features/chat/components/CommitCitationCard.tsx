"use client";

import {
  CommitAuthor,
  CommitHash,
  CommitMetadata,
  CommitMessage,
  CommitSeparator,
  CommitTimestamp,
} from "@/src/components/ai-elements/commit";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/src/components/ui/hover-card";
import { cn } from "@/src/shared/lib/utils";
import { ExternalLink } from "lucide-react";
import type { ChatMessage } from "@/src/shared/types";

type Props = {
  citation: ChatMessage["citations"][number];
};

/**
 * A cited commit: the subject plus `hash • author • time • files`. The whole
 * card links to the commit, and hovering (or focusing) it reveals the full
 * commit description without leaving the page.
 */
export function CommitCitationCard({ citation }: Props) {
  const shortSha = citation.commitSha.slice(0, 7);
  const [subjectLine, ...bodyLines] = citation.commitMessage.split("\n");
  const subject = subjectLine.trim();
  const body = bodyLines.join("\n").trim();
  const fileCount = citation.filesChanged.length;

  const cardBody = (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CommitMessage className="line-clamp-2" title={subject}>
          {subject || "(no message)"}
        </CommitMessage>
        <CommitMetadata className="pt-0.5">
          <CommitHash>{shortSha}</CommitHash>
          {citation.author && (
            <>
              <CommitSeparator />
              <CommitAuthor>{citation.author}</CommitAuthor>
            </>
          )}
          <CommitSeparator />
          <CommitTimestamp date={new Date(citation.committedAt)} />
          {fileCount > 0 && (
            <>
              <CommitSeparator />
              <span>
                {fileCount} {fileCount === 1 ? "file" : "files"}
              </span>
            </>
          )}
        </CommitMetadata>
      </div>
      {citation.commitUrl && (
        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
      )}
    </div>
  );

  const cardClassName = "block rounded-lg border bg-background p-3";

  const trigger = citation.commitUrl ? (
    <a
      href={citation.commitUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Open commit"
      className={cn(cardClassName, "transition-colors hover:bg-muted/50")}
    >
      {cardBody}
    </a>
  ) : (
    <div className={cardClassName}>{cardBody}</div>
  );

  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-80">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{subject || "(no message)"}</span>
          <p className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
            {body || "No description."}
          </p>
          {citation.commitUrl && (
            <a
              href={citation.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-medium underline-offset-2 hover:underline"
            >
              Open on GitHub →
            </a>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
