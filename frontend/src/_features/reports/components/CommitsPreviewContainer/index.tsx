"use client";

import { Card, CardContent } from "@/src/components/ui/card";
import { Label } from "@/src/components/ui/label";
import { Skeleton } from "@/src/components/ui/skeleton";
import { GitCommit, Loader2 } from "lucide-react";
import { CommitsPreviewDialog } from "../CommitsPreviewDialog";
import type { ProcessedCommit } from "@/src/shared/types";

type Props = {
  startDate?: string;
  isFetching: boolean;
  hasError: boolean;
  commitCount: number;
  commits: ProcessedCommit[];
};

export function CommitsPreviewContainer({
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
          <Label className="text-sm font-semibold whitespace-nowrap">
            Sync Status
          </Label>
          <div className="flex items-center gap-2">
            {isFetching ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <Skeleton className="h-4 w-32 bg-muted" />
              </div>
            ) : hasError ? (
              <span className="text-sm text-muted-foreground">
                Verification failed. Check connection.
              </span>
            ) : (
              <div className="flex items-center gap-2">
                {commitCount === 0 ? (
                  <span className="text-sm text-muted-foreground">
                    No commits found for this period
                  </span>
                ) : (
                  <CommitsPreviewDialog
                    commits={commits as ProcessedCommit[]}
                    commitCount={commitCount}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
