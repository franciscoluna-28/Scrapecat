"use client";

import { Card, CardContent } from "@/src/components/ui/card";
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

/**
 * Live commits preview in the report generation form. Reads the local git
 * archive for the currently selected date range + branch and shows the total
 * count with a "View commits" dialog — exactly the UI that used to live here.
 */
export function CommitsPreviewCard({
  startDate,
  isFetching,
  hasError,
  commitCount,
  commits,
}: Props) {
  if (!startDate) return null;

  return (
    <Card className="border-none shadow-none">
      <CardContent className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted border">
          <GitCommit className="h-4 w-4 text-muted-foreground" />
        </div>

        <div className="flex flex-col overflow-hidden">
          <span className="text-xs text-muted-foreground">Source Commits</span>
          <div className="flex items-center gap-2">
            {isFetching ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Reading commits from the repository...
                </span>
              </div>
            ) : hasError ? (
              <span className="text-sm text-muted-foreground">
                Couldn&apos;t read commits. Check the repository connection.
              </span>
            ) : commitCount === 0 ? (
              <span className="text-sm text-muted-foreground">
                No commits found for this period
              </span>
            ) : (
              <CommitsPreviewDialog commits={commits} commitCount={commitCount} />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
