"use client";

import { ExternalLink } from "lucide-react";
import type { ChatMessage } from "@/src/shared/types";

type Props = {
  citation: ChatMessage["citations"][number];
};

export function CitationCard({ citation }: Props) {
  const shortSha = citation.commitSha.slice(0, 7);
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-mono font-medium text-foreground">{shortSha}</span>
      {citation.author && (
        <>
          <span className="text-muted-foreground/60">·</span>
          <span>{citation.author}</span>
        </>
      )}
      {citation.commitUrl && (
        <a
          href={citation.commitUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground ml-auto shrink-0"
          aria-label="Open commit"
        >
          <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}