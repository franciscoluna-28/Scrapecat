"use client";

import {
  CommitAuthor,
  CommitHash,
  CommitMetadata,
  CommitMessage,
  CommitSeparator,
  CommitTimestamp,
} from "@/src/components/ai-elements/commit";
import { cn } from "@/src/shared/lib/utils";
import { ExternalLink } from "lucide-react";
import type { ChatMessage } from "@/src/shared/types";

type Props = {
  citation: ChatMessage["citations"][number];
};

/**
 * A cited commit, rendered like a conventional commit: subject line, body
 * description, then `hash • author • time • files`. The whole card links to the
 * commit when a URL is available.
 */
export function CommitCitationCard({ citation }: Props) {
  const shortSha = citation.commitSha.slice(0, 7);
  const [subjectLine, ...bodyLines] = citation.commitMessage.split("\n");
  const subject = subjectLine.trim();
  const body = bodyLines.join("\n").trim();
  const fileCount = citation.filesChanged.length;

  const content = (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <CommitMessage className="line-clamp-2" title={subject}>
          {subject || "(no message)"}
        </CommitMessage>
        {body && (
          <p className="line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
            {body}
          </p>
        )}
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

  if (citation.commitUrl) {
    return (
      <a
        href={citation.commitUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Open commit"
        className={cn(cardClassName, "transition-colors hover:bg-muted/50")}
      >
        {content}
      </a>
    );
  }

  return <div className={cardClassName}>{content}</div>;
}
