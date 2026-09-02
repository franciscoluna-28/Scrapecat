"use client";

import { GitCommit, Loader2 } from "lucide-react";
import { CommitsPreviewDialog } from "@/src/_features/reports/components/CommitsPreviewDialog";
import type { RepoCommit } from "@/src/_features/reports/services/api";

type Props = {
  startDate?: string;
  isFetching: boolean;
  hasError: boolean;
  commitCount: number;
  commits: RepoCommit[];
};

export function CommitsPreviewCard({
  startDate,
  isFetching,
  hasError,
  commitCount,
  commits,
}: Props) {
  if (!startDate) return null;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <GitCommit className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground truncate">Source Commits</span>
      </div>
      <div className="shrink-0">
        {isFetching ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Reading commits...
          </div>
        ) : hasError ? (
          <span className="text-xs text-destructive">Failed to load commits</span>
        ) : commitCount === 0 ? (
          <span className="text-xs text-muted-foreground">No commits found for this period</span>
        ) : (
          <CommitsPreviewDialog commits={commits} commitCount={commitCount} />
        )}
      </div>
    </div>
  );
}
