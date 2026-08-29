"use client";

import { Card, CardContent } from "@/src/components/ui/card";
import { GitCommit, ExternalLink } from "lucide-react";
import type { ChatMessage } from "@/src/shared/types";

type Props = {
  citation: ChatMessage["citations"][number];
};

export function CitationCard({ citation }: Props) {
  const shortSha = citation.commitSha.slice(0, 7);
  return (
    <Card className="overflow-hidden bg-muted/40">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start gap-2">
          <GitCommit className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-xs leading-relaxed line-clamp-2 [overflow-wrap:anywhere]">
              {citation.commitMessage}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground/60 mt-0.5">
              {shortSha}
              <span className="font-sans text-muted-foreground/60 ml-2">
                {new Date(citation.committedAt).toLocaleDateString("en-US")}
              </span>
            </p>
          </div>
          {citation.commitUrl && (
            <a
              href={citation.commitUrl}
              target="_blank"
              rel="noreferrer"
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {citation.filesChanged.length > 0 && (
          <p className="pl-5 text-[11px] text-muted-foreground truncate">
            {citation.filesChanged.slice(0, 3).join(", ")}
            {citation.filesChanged.length > 3
              ? ` +${citation.filesChanged.length - 3} more`
              : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
