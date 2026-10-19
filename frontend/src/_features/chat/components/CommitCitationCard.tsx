"use client";

import {
  CommitAuthor,
  CommitHash,
  CommitMetadata,
  CommitMessage,
  CommitSeparator,
  CommitTimestamp,
} from "@/src/components/ai-elements/commit";
import type { ChatMessage } from "@/src/shared/types";

type Props = {
  citation: ChatMessage["citations"][number];
};

/**
 * A cited commit: subject, a one-line description, and
 * `hash • author • time • files`. The whole card links to the commit.
 */
export function CommitCitationCard({ citation }: Props) {
  const shortSha = citation.commitSha.slice(0, 7);
  const [subjectLine, ...bodyLines] = citation.commitMessage.split("\n");
  const subject = subjectLine.trim();
  const description = bodyLines.join(" ").replace(/\s+/g, " ").trim();
  const fileCount = citation.filesChanged.length;

  const card = (
    <div className="flex flex-col gap-1">
      <CommitMessage className="line-clamp-2" title={subject}>
        {subject || "(no message)"}
      </CommitMessage>
      {description && (
        <p className="line-clamp-1 text-xs text-muted-foreground">{description}</p>
      )}
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

  const cardClassName = "block rounded-lg border bg-background p-3";

  if (citation.commitUrl) {
    return (
      <a
        href={citation.commitUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Open commit"
        className={`${cardClassName} transition-colors hover:bg-muted/50`}
      >
        {card}
      </a>
    );
  }

  return <div className={cardClassName}>{card}</div>;
}
