"use client";

import { FileText } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/components/ui/sheet";
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
  const period = report ? formatUtcWithLocal(report.periodEnd) : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        tabIndex={-1}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement).focus();
        }}
        className="flex flex-col gap-0 p-0 outline-none data-[side=right]:w-full data-[side=right]:sm:max-w-3xl"
      >
        <SheetHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <SheetTitle>Report</SheetTitle>
          <SheetDescription>
            {report
              ? `${report.providerOwner}/${report.repositoryName} · ${report.branch}`
              : "Summary details and the commits used to generate them."}
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-3 overflow-y-auto px-6 py-5">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {error && (
          <p className="overflow-y-auto px-6 py-5 text-sm text-destructive">
            {errorMessage(error, "Failed to load report")}
          </p>
        )}

        {report && (
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
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
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
