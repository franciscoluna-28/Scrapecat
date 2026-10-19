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
import type { ChatMessage } from "@/src/shared/types";

type Props = {
  citation: ChatMessage["citations"][number];
};

/**
 * A cited commit. The whole card links to the commit; when the commit has a
 * description, hovering (or focusing) the card reveals it inline.
 */
export function CommitCitationCard({ citation }: Props) {
  const shortSha = citation.commitSha.slice(0, 7);
  const [subjectLine, ...bodyLines] = citation.commitMessage.split("\n");
  const subject = subjectLine.trim();
  const body = bodyLines.join("\n").trim();
  const fileCount = citation.filesChanged.length;

  const card = (
    <div className="flex flex-col gap-1">
      <CommitMessage className="line-clamp-2" title={subject}>
        {subject || "(no message)"}
      </CommitMessage>
      <CommitMetadata>
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
  );

  const trigger = citation.commitUrl ? (
    <a
      href={citation.commitUrl}
      target="_blank"
      rel="noreferrer"
      aria-label="Open commit"
      className="block rounded-lg border bg-background p-3 transition-colors hover:bg-muted/50"
    >
      {card}
    </a>
  ) : (
    <div className="block rounded-lg border bg-background p-3">{card}</div>
  );

  if (!body) return trigger;

  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-80">
        <p className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">
          {body}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}
