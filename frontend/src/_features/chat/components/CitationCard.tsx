"use client";

import {
  Commit,
  CommitActions,
  CommitAuthor,
  CommitContent,
  CommitCopyButton,
  CommitFile,
  CommitFileIcon,
  CommitFileInfo,
  CommitFilePath,
  CommitFiles,
  CommitHash,
  CommitHeader,
  CommitInfo,
  CommitMetadata,
  CommitMessage,
  CommitSeparator,
  CommitTimestamp,
} from "@/src/components/ai-elements/commit";
import { Button } from "@/src/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { ChatMessage } from "@/src/shared/types";

type Props = {
  citation: ChatMessage["citations"][number];
};

export function CitationCard({ citation }: Props) {
  const shortSha = citation.commitSha.slice(0, 7);
  return (
    <Commit>
      <CommitHeader>
        <CommitInfo>
          <CommitMessage>{citation.commitMessage}</CommitMessage>
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
          </CommitMetadata>
        </CommitInfo>
        <CommitActions>
          <CommitCopyButton hash={citation.commitSha} />
          {citation.commitUrl && (
            <Button asChild size="icon-sm" variant="ghost">
              <a
                href={citation.commitUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open commit"
              >
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          )}
        </CommitActions>
      </CommitHeader>
      {citation.filesChanged.length > 0 && (
        <CommitContent>
          <CommitFiles>
            {citation.filesChanged.map((file) => (
              <CommitFile key={file}>
                <CommitFileInfo>
                  <CommitFileIcon />
                  <CommitFilePath>{file}</CommitFilePath>
                </CommitFileInfo>
              </CommitFile>
            ))}
          </CommitFiles>
        </CommitContent>
      )}
    </Commit>
  );
}
