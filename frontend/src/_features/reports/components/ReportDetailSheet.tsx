"use client";

import { FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
import { ScrollArea } from "@/src/components/ui/scroll-area";
import { Badge } from "@/src/components/ui/badge";
import { Skeleton } from "@/src/components/ui/skeleton";
import { MessageResponse } from "@/src/components/ai-elements/message";
import { SourceCommits } from "@/src/_features/reports/components/SourceCommits";
import { useReport } from "@/src/_features/reports/services/reports-api";
import {
  formatPeriod,
  formatRelativeTime,
  formatUtcWithLocal,
} from "@/src/_features/reports/lib/time";
import { errorMessage } from "@/src/shared/api/client";

type Props = {
  reportId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ReportDetailSheet({ reportId, open, onOpenChange }: Props) {
  const { report, isLoading, error } = useReport(reportId);
  const period = report
    ? formatUtcWithLocal(report.periodEnd)
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>Report</SheetTitle>
          <SheetDescription>
            {report
              ? `${report.providerOwner}/${report.repositoryName} · ${report.branch}`
              : "Summary details and the commits used to generate them."}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-3 px-4">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <p className="px-4 text-sm text-destructive">
            {errorMessage(error, "Failed to load report")}
          </p>
        )}

        {report && (
          <ScrollArea className="flex-1 px-4 pb-6">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    <FileText data-icon="inline-start" />
                    {formatPeriod(report.periodStart, report.periodEnd)}
                  </Badge>
                  {report.provider && report.model ? (
                    <Badge variant="secondary">
                      {report.provider}/{report.model}
                    </Badge>
                  ) : (
                    <Badge variant="outline">Quiet period</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Generated {formatRelativeTime(report.createdAt)}
                  {period ? ` · ${period.local} your time` : ""}
                </p>
              </div>

              <MessageResponse>{report.summary}</MessageResponse>

              <SourceCommits commits={report.sourceCommits} />
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  );
}
